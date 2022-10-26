import * as fs from 'fs/promises';
import * as path from 'path';
import * as cp from 'child_process';
import { rmSync } from 'fs';

import { EnvUtil, ExecUtil, ExecutionState, ExecutionResult, ShutdownManager } from '@travetto/base';

/**
 * Simple docker wrapper for launching and interacting with a container
 */
export class DockerContainer {

  static #getNamespace(image: string): string {
    return EnvUtil.isTrue('TRV_DOCKER') ? image : EnvUtil.get('TRV_DOCKER', image);
  }

  static #getContainerName(image: string, container?: string): string {
    return container ?? `${this.#getNamespace(image)}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
  }

  /** Command to run */
  #dockerCmd: string = 'docker';
  /** List of pending executions */
  #pendingExecutions = new Set<ExecutionState>();

  /** Container name */
  #container: string;
  /** Env variables to share */
  #env = new Map<string, string>();
  /** Ports to expose */
  #ports = new Map<number, number>();
  /** List of temporary volumes and their mappings */
  #tempVolumes = new Map<string, string>();
  /** Remove container on finish */
  #deleteOnFinish = false;
  /** A flag to indicate if the container should be evicted */
  #evict: boolean = false;
  /** Internal flag to indicate if the container is unresponsive */
  #runAway: boolean = false;
  /** Labels */
  #labels: string[] = [];
  /**
   * List of volumes to mount
   */
  #volumes = new Map<string, string>();

  /** Entry point to launch */
  #entryPoint: string;
  /** Does the container take input */
  #interactive: boolean = false;
  /** Should we allocate a terminal for the container */
  #tty: boolean = false;
  /** Run in background mode? */
  #daemon: boolean = false;
  /** Run in privileged mode? */
  #privileged: boolean = false;
  /** Should the process be unref'd */
  #unref = true;

  /**
   * Working directory
   */
  #workingDir: string;
  /**
   * Image to run
   */
  #image: string;

  constructor(image: string, container?: string) {
    this.#image = image;
    this.#container = DockerContainer.#getContainerName(image, container);
  }

  /**
   * Watch execution for any failed state and evict as needed
   */
  #watchForEviction(state: ExecutionState, all = false): ExecutionState {
    state.result = state.result.catch(err => {
      if (all || err.killed) {
        this.#evict = true;
        this.#pendingExecutions.clear();
      }
      throw err;
    });
    return state;
  }

  #execSync(...args: string[]): string {
    return cp.execSync(`${this.#dockerCmd} ${args.join(' ')}`, { stdio: ['pipe', 'pipe'], encoding: 'utf8' }).toString().trim();
  }

  /**
   * Run a a docker command
   */
  #runCmd(op: 'create' | 'run' | 'start' | 'stop' | 'exec', ...args: string[]): ExecutionState {
    const state = ExecUtil.spawn(this.#dockerCmd, [op, ...(args ?? [])], { shell: this.#tty });
    return (op !== 'run' && op !== 'exec') ? this.#watchForEviction(state, true) : state;
  }

  /**
   * Get unique identifier for the current execution
   */
  get id(): string {
    const first = this.#pendingExecutions.size > 0 ? this.#pendingExecutions.values().next().value : undefined;
    return first && !first.process.killed ? first.process.pid : -1;
  }

  /**
   * Force destroy of container when the app shuts down
   */
  forceDestroyOnShutdown(): this {
    ShutdownManager.onShutdown(this.#container, () => this.forceDestroy());
    return this;
  }

  /**
   * Mark delete on finish
   */
  setDeleteOnFinish(yes: boolean): this {
    this.#deleteOnFinish = yes;
    return this;
  }

  /**
   * Create a temp dir and mount as a volume
   */
  async createTempVolume(volume: string): Promise<this> {
    const p = await fs.mkdtemp(`/tmp/${this.#image.replace(/[^A-Za-z0-9]/g, '_')}`);
    this.#tempVolumes.set(volume, p);
    return this;
  }

  /**
   * Get temp directory location
   */
  getTempVolumePath(volume: string): string | undefined {
    return this.#tempVolumes.get(volume);
  }

  /**
   * Expose a port
   */
  exposePort(port: number, internalPort = port): this {
    this.#ports.set(port, internalPort);
    return this;
  }

  /**
   * Add label
   * @param label
   */
  addLabel(label: string): this {
    this.#labels.push(label);
    return this;
  }

  /**
   * Add an environment variable
   */
  addEnvVar(key: string, value: string = ''): this {
    this.#env.set(key, value);
    return this;
  }

  /**
   * Add many environment variables
   */
  addEnvVars(vars: Record<string, string>): this {
    for (const [k, v] of Object.entries(vars)) {
      this.#env.set(k, v);
    }
    return this;
  }

  /**
   * Add a volume into the container
   */
  addVolume(local: string, container: string): this {
    this.#volumes.set(local, container);
    return this;
  }

  /**
   * Set working directory
   */
  setWorkingDir(container: string): this {
    this.#workingDir = container;
    return this;
  }

  /**
   * Set interactive mode
   */
  setInteractive(on: boolean): this {
    this.#interactive = on;
    return this;
  }

  /**
   * Allocate tty
   */
  setTTY(on: boolean): this {
    this.#tty = on;
    return this;
  }

  /**
   * Set the entry point for the container
   */
  setEntryPoint(point: string): this {
    this.#entryPoint = point;
    return this;
  }

  /**
   * Mark execution as daemon
   */
  setDaemon(on: boolean): this {
    this.#daemon = on;
    return this;
  }

  /**
   * Mark execution as privileged
   */
  setPrivileged(on?: boolean): this {
    this.#privileged = !!on;
    return this;
  }

  /**
   * Set unref status
   * @param on
   */
  setUnref(on: boolean): this {
    this.#unref = on;
    return this;
  }

  /**
   * Get flags for running a container
   */
  getRuntimeFlags(extra?: string[]): string[] {
    const flags: string[] = [];
    if (this.#interactive) {
      flags.push('-i');
    }
    if (this.#tty) {
      flags.push('-t');
    }
    for (const [k, v] of this.#env.entries()) {
      flags.push('-e', v === '' ? k : `${k}=${v}`);
    }
    flags.push(...(extra ?? []));
    return flags;
  }

  /**
   * Get flags for launching a container
   */
  getLaunchFlags(extra?: string[]): string[] {
    const flags: string[] = [];
    if (this.#workingDir) {
      flags.push('-w', this.#workingDir);
    }
    if (this.#deleteOnFinish) {
      flags.push('--rm');
    }
    if (this.#entryPoint) {
      flags.push('--entrypoint', this.#entryPoint);
    }
    if (this.#daemon) {
      flags.push('-d');
    }
    if (this.#privileged) {
      flags.push('--privileged');
    }
    for (const [k, v] of this.#volumes.entries()) {
      flags.push('-v', `${k}:${v}`);
    }
    for (const [k, v] of this.#tempVolumes.entries()) {
      flags.push('-v', `${v}:${k}`);
    }
    for (const [k, v] of this.#ports.entries()) {
      flags.push('-p', `${k}:${v}`);
    }
    for (const l of this.#labels) {
      flags.push('-l', l);
    }
    flags.push(...this.getRuntimeFlags(extra));

    return flags;
  }

  /**
   * Create all temp dirs
   */
  async initTemp(): Promise<void> {
    await Promise.all( // Make temp dirs
      [...this.#tempVolumes.keys()].map(x => fs.mkdir(x, { recursive: true })));
  }

  /**
   * Create a docker container
   */
  async create(args?: string[], flags?: string[]): Promise<ExecutionResult> {
    const allFlags = this.getLaunchFlags(flags);
    return this.#runCmd('create', '--name', this.#container, ...allFlags, this.#image, ...(args ?? [])).result;
  }

  /**
   * Start a docker container
   */
  async start(args?: string[], flags?: string[]): Promise<ExecutionResult> {
    await this.initTemp();
    return this.#runCmd('start', ...(flags ?? []), this.#container, ...(args ?? [])).result;
  }

  /**
   * Stop a container
   */
  async stop(args?: string[], flags?: string[]): Promise<ExecutionResult> {
    const toStop = this.#runCmd('stop', ...(flags ?? []), this.#container, ...(args ?? [])).result;
    let prom = toStop;
    if (this.#pendingExecutions) {
      const pendingResults = [...this.#pendingExecutions.values()].map(e => e.result);
      this.#pendingExecutions.clear();
      prom = Promise.all([toStop, ...pendingResults]).then(([first]) => first);
    }
    return prom;
  }

  /**
   * Exec a docker container
   */
  exec(args?: string[], extraFlags?: string[]): ExecutionState {
    const flags = this.getRuntimeFlags(extraFlags);
    const execState = this.#runCmd('exec', ...flags, this.#container, ...(args ?? []));
    this.#pendingExecutions.add(execState);

    execState.result.finally(() => this.#pendingExecutions.delete(execState));

    return execState;
  }

  /**
   * Run a container
   */
  async run(args?: string[], flags?: string[]): Promise<ExecutionResult> {

    if (!this.#deleteOnFinish) {
      // Kill existing
      await this.destroy();
      await this.removeDanglingVolumes();
    }

    await this.initTemp();

    const execState = this.#runCmd('run', `--name=${this.#container}`, ...this.getLaunchFlags(flags), this.#image, ...(args ?? []));
    this.#pendingExecutions.add(execState);

    this.#watchForEviction(execState);
    if (this.#unref) {
      execState.process.unref();
    }

    return execState.result.finally(() => this.#pendingExecutions.delete(execState));
  }

  /**
   * Determine if container is still viable
   */
  async validate(): Promise<boolean> {
    return !this.#runAway;
  }

  /**
   * Destroy container, mark as runaway if needed
   */
  async destroy(runAway: boolean = false): Promise<void> {
    console.debug('Destroying', { image: this.#image, container: this.#container });
    this.#runAway = this.#runAway || runAway;

    try {
      await ExecUtil.spawn(this.#dockerCmd, ['kill', this.#container]).result;
    } catch { }

    console.debug('Removing', { image: this.#image, container: this.#container });

    try {
      await ExecUtil.spawn(this.#dockerCmd, ['rm', '-fv', this.#container]).result;
    } catch { }

    if (this.#pendingExecutions.size) {
      const results = [...this.#pendingExecutions.values()].map(x => x.result);
      this.#pendingExecutions.clear();
      await Promise.all(results);
    }

    await this.cleanup();
  }

  /**
   * Force destruction, immediately
   */
  forceDestroy(): void { // Cannot be async as it's used on exit, that's why it's all sync
    try {
      this.#execSync('kill', this.#container);
    } catch { }

    console.debug('Removing', { image: this.#image, container: this.#container });

    try {
      this.#execSync('rm', '-fv', this.#container);
    } catch { }

    this.cleanupSync();

    const ids = this.#execSync('volume', 'ls', '-qf', 'dangling=true');
    if (ids) {
      this.#execSync('volume', 'rm', ...ids.split('\n'));
    }
  }

  /**
   * Write files to folder for mapping into execution
   */
  async writeFiles(dir: string, files?: { name: string, content: string }[]): Promise<void> {
    await this.cleanup();
    if (files) {
      await Promise.all(
        files.map(({ name, content }) =>
          fs.writeFile(path.join(dir, name), content, { mode: '755' }))
      );
    }
    return;
  }

  /**
   * Cleanup a container, delete all temp volumes
   */
  async cleanup(): Promise<void> {
    console.debug('Cleaning', { image: this.#image, container: this.#container });

    await Promise.all(
      [...this.#tempVolumes.keys()]
        .map(x => fs.rm(x, { recursive: true, force: true }))
    );
  }

  /**
   * Cleanup synchronously, for shutdown
   */
  cleanupSync(): void {
    console.debug('Cleaning', { image: this.#image, container: this.#container });

    for (const [vol,] of this.#tempVolumes) {
      rmSync(vol, { recursive: true, force: true });
    }
  }

  /**
   * Remove all volumes form docker that aren't in use
   */
  async removeDanglingVolumes(): Promise<void> {
    try {
      const { result } = ExecUtil.spawn(this.#dockerCmd, ['volume', 'ls', '-qf', 'dangling=true']);
      const ids = (await result).stdout.trim();
      if (ids) {
        await ExecUtil.spawn(this.#dockerCmd, ['volume', 'rm', ...ids.split('\n')]).result;
      }
    } catch {
      // ignore
    }
  }
}