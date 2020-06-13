import * as fs from 'fs';
import * as util from 'util';

import { FsUtil, EnvUtil, ExecUtil, ExecutionState } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

const fsWriteFile = util.promisify(fs.writeFile);

/**
 * Simple docker wrapper for launching and interacting with a container
 */
export class DockerContainer {

  private static getNamespace(image: string) {
    return EnvUtil.isTrue('TRV_DOCKER') ? image : EnvUtil.get('TRV_DOCKER', image);
  }

  private static getContainerName(image: string, container?: string) {
    return container ?? `${this.getNamespace(image)}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
  }

  /** Command to run */
  private dockerCmd: string = 'docker';
  /** List of pending executions */
  private pendingExecutions = new Set<ExecutionState>();

  /** Container name */
  private container: string;
  /** Env variables to share */
  private env = new Map<string, string>();
  /** Ports to expose */
  private ports = new Map<number, number>();
  /** List of temporary volumes and their mappings */
  private tempVolumes = new Map<string, string>();
  /** Remove container on finish */
  private deleteOnFinish = false;
  /** A flag to indicate if the container should be evicted */
  private evict: boolean = false;
  /** Internal flag to indicate if the container is unresponsive */
  private runAway: boolean = false;
  /** Labels */
  private labels: string[] = [];
  /**
   * List of volumes to mount
   */
  private volumes = new Map<string, string>();

  /** Entry point to launch */
  private entryPoint: string;
  /** Does the container take input */
  private interactive: boolean = false;
  /** Should we allocate a terminal for the container */
  private tty: boolean = false;
  /** Run in background mode? */
  private daemon: boolean = false;
  /** Should the process be unref'd */
  private unref = true;

  /**
   * Working directory
   */
  private workingDir: string;

  constructor(private image: string, container?: string) {
    this.container = DockerContainer.getContainerName(image, container);
  }

  /**
   * Watch execution for any failed state and evict as needed
   */
  private watchForEviction(state: ExecutionState, all = false) {
    state.result = state.result.catch(e => {
      if (all || e.killed) {
        this.evict = true;
        this.pendingExecutions.clear();
      }
      throw e;
    });
    return state;
  }

  /**
   * Run a a docker command
   */
  private runCmd(op: 'create' | 'run' | 'start' | 'stop' | 'exec', ...args: any[]) {
    const state = ExecUtil.spawn(this.dockerCmd, [op, ...(args ?? [])], { shell: this.tty });
    return (op !== 'run' && op !== 'exec') ? this.watchForEviction(state, true) : state;
  }

  /**
   * Get unique identifier for the current execution
   */
  get id() {
    const first = this.pendingExecutions.size > 0 ? this.pendingExecutions.values().next().value : undefined;
    return first && !first.process.killed ? first.process.pid : -1;
  }

  /**
   * Force destroy of container when the app shuts down
   */
  forceDestroyOnShutdown() {
    ShutdownManager.onShutdown(this.container, () => this.forceDestroy());
    return this;
  }

  /**
   * Mark delete on finish
   */
  setDeleteOnFinish(yes: boolean) {
    this.deleteOnFinish = yes;
    return this;
  }

  /**
   * Create a tempdir and mount as a volume
   */
  createTempVolume(volume: string) {
    const p = fs.mkdtempSync(`/tmp/${this.image.replace(/[^A-Za-z0-9]/g, '_')}`);
    this.tempVolumes.set(volume, p);
    return this;
  }

  /**
   * Get temp directory location
   */
  getTempVolumePath(volume: string) {
    return this.tempVolumes.get(volume);
  }

  /**
   * Expose a port
   */
  exposePort(port: number, internalPort = port) {
    this.ports.set(port, internalPort);
    return this;
  }

  /**
   * Add label
   * @param label
   */
  addLabel(label: string) {
    this.labels.push(label);
    return this;
  }

  /**
   * Add an environment variable
   */
  addEnvVar(key: string, value: string = '') {
    this.env.set(key, value);
    return this;
  }

  /**
   * Add many environment variables
   */
  addEnvVars(vars: Record<string, string>) {
    for (const [k, v] of Object.entries(vars)) {
      this.env.set(k, v);
    }
    return this;
  }

  /**
   * Add a volume into the container
   */
  addVolume(local: string, container: string) {
    this.volumes.set(local, container);
    return this;
  }

  /**
   * Set working directory
   */
  setWorkingDir(container: string) {
    this.workingDir = container;
    return this;
  }

  /**
   * Set interactive mode
   */
  setInteractive(on: boolean) {
    this.interactive = on;
    return this;
  }

  /**
   * Allocate tty
   */
  setTTY(on: boolean) {
    this.tty = on;
    return this;
  }

  /**
   * Set the entry point for the container
   */
  setEntryPoint(point: string) {
    this.entryPoint = point;
    return this;
  }

  /**
   * Mark execution as daemon
   */
  setDaemon(on: boolean) {
    this.daemon = on;
    return this;
  }

  /**
   * Set unref status
   * @param on 
   */
  setUnref(on: boolean) {
    this.unref = on;
    return this;
  }

  /**
   * Get flags for running a container
   */
  getRuntimeFlags(extra?: string[]) {
    const flags = [];
    if (this.interactive) {
      flags.push('-i');
    }
    if (this.tty) {
      flags.push('-t');
    }
    for (const [k, v] of this.env.entries()) {
      flags.push('-e', v === '' ? k : `${k}=${v}`);
    }
    flags.push(...(extra ?? []));
    return flags;
  }

  /**
   * Get flags for launching a container
   */
  getLaunchFlags(extra?: string[]) {
    const flags = [];
    if (this.workingDir) {
      flags.push('-w', this.workingDir);
    }
    if (this.deleteOnFinish) {
      flags.push('--rm');
    }
    if (this.entryPoint) {
      flags.push('--entrypoint', this.entryPoint);
    }
    if (this.daemon) {
      flags.push('-d');
    }
    for (const [k, v] of this.volumes.entries()) {
      flags.push('-v', `${k}:${v}`);
    }
    for (const [k, v] of this.tempVolumes.entries()) {
      flags.push('-v', `${v}:${k}`);
    }
    for (const [k, v] of this.ports.entries()) {
      flags.push('-p', `${k}:${v}`);
    }
    for (const l of this.labels) {
      flags.push('-l', l);
    }
    flags.push(...this.getRuntimeFlags(extra));

    return flags;
  }

  /**
   * Create all temp dirs
   */
  async initTemp() {
    await Promise.all( // Make temp dirs
      Object.keys(this.tempVolumes).map(x => FsUtil.mkdirp(x)));
  }

  /**
   * Create a docker container
   */
  async create(args?: string[], flags?: string[]) {
    const allFlags = this.getLaunchFlags(flags);
    return this.runCmd('create', '--name', this.container, ...allFlags, this.image, ...(args ?? [])).result;
  }

  /**
   * Start a docker container
   */
  async start(args?: string[], flags?: string[]) {
    await this.initTemp();
    return this.runCmd('start', ...(flags ?? []), this.container, ...(args ?? [])).result;
  }

  /**
   * Stop a container
   */
  async stop(args?: string[], flags?: string[]) {
    const toStop = this.runCmd('stop', ...(flags ?? []), this.container, ...(args ?? [])).result;
    let prom = toStop;
    if (this.pendingExecutions) {
      const pendingResults = [...this.pendingExecutions.values()].map(e => e.result);
      this.pendingExecutions.clear();
      prom = Promise.all([toStop, ...pendingResults]).then(([first]) => first);
    }
    return prom;
  }

  /**
   * Exec a docker container
   */
  exec(args?: string[], extraFlags?: string[]) {
    const flags = this.getRuntimeFlags(extraFlags);
    const execState = this.runCmd('exec', ...flags, this.container, ...(args ?? []));
    this.pendingExecutions.add(execState);

    execState.result = execState.result.finally(() => this.pendingExecutions.delete(execState));

    return execState;
  }

  /**
   * Run a container
   */
  async run(args?: any[], flags?: string[]) {

    if (!this.deleteOnFinish) {
      // Kill existing
      await this.destroy();
      await this.removeDanglingVolumes();
    }

    await this.initTemp();

    const execState = this.runCmd('run', `--name=${this.container}`, ...this.getLaunchFlags(flags), this.image, ...(args ?? []));
    this.pendingExecutions.add(execState);

    this.watchForEviction(execState);
    if (this.unref) {
      execState.process.unref();
    }

    return execState.result.finally(() => this.pendingExecutions.delete(execState));
  }

  /**
   * Determine if container is still viable
   */
  async validate() {
    return !this.runAway;
  }

  /**
   * Destroy container, mark as runaway if needed
   */
  async destroy(runAway: boolean = false) {
    console.debug('Destroying', this.image, this.container);
    this.runAway = this.runAway || runAway;

    try {
      await ExecUtil.spawn(this.dockerCmd, ['kill', this.container]).result;
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      await ExecUtil.spawn(this.dockerCmd, ['rm', '-fv', this.container]).result;
    } catch (e) { /* ignore */ }

    if (this.pendingExecutions.size) {
      const results = [...this.pendingExecutions.values()].map(x => x.result);
      this.pendingExecutions.clear();
      await Promise.all(results);
    }

    await this.cleanup();
  }

  /**
   * Force destruction, immediately
   */
  forceDestroy() { // Cannot be async as it's used on exit, that's why it's all sync
    try {
      ExecUtil.execSync(`${this.dockerCmd} kill ${this.container}`);
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      ExecUtil.execSync(`${this.dockerCmd} rm -fv ${this.container}`);
    } catch (e) { /* ignore */ }

    this.cleanupSync();

    const ids = ExecUtil.execSync(`${this.dockerCmd} volume ls -qf dangling=true`);
    if (ids) {
      ExecUtil.execSync(`${this.dockerCmd} volume rm ${ids.split('\n').join(' ')}`);
    }
  }

  /**
   * Write files to folder for mapping into execution
   */
  async writeFiles(dir: string, files?: { name: string, content: string }[]) {
    await this.cleanup();
    if (files) {
      await Promise.all(
        files.map(({ name, content }) =>
          fsWriteFile(FsUtil.joinUnix(dir, name), content, { mode: '755' }))
      );
    }
    return;
  }

  /**
   * Cleanup a container, delete all temp volumes
   */
  async cleanup() {
    console.debug('Cleaning', this.image, this.container);

    await Promise.all(
      Object.keys(this.tempVolumes)
        .map(x => FsUtil.unlinkRecursive(x, true))
    );
  }

  /**
   * Cleanup synchronously, for shutdown
   */
  cleanupSync() {
    console.debug('Cleaning', this.image, this.container);

    for (const vol of Object.keys(this.tempVolumes)) {
      FsUtil.unlinkRecursiveSync(vol, true);
    }
  }

  /**
   * Remove all volumes form docker that aren't in use
   */
  async removeDanglingVolumes() {
    try {
      const { result } = ExecUtil.spawn(this.dockerCmd, ['volume', 'ls', '-qf', 'dangling=true']);
      const ids = (await result).stdout.trim();
      if (ids) {
        await ExecUtil.spawn(this.dockerCmd, ['volume', 'rm', ...ids.split('\n')]).result;
      }
    } catch (e) {
      // error
    }
  }
}