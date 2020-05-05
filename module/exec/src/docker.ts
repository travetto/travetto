import * as fs from 'fs';
import * as util from 'util';

import { FsUtil, EnvUtil, ExecUtil, ExecutionState } from '@travetto/boot';
import { ShutdownManager } from '@travetto/base';

const fsWriteFile = util.promisify(fs.writeFile);

// TODO: Document
export class DockerContainer {

  private static getContainerName(image: string, container?: string) {
    return container ?? `${EnvUtil.get('DOCKER_NS', image)}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
  }

  private dockerCmd: string = 'docker';
  private pendingExecutions = new Set<ExecutionState>();

  private container: string;
  private env: Record<string, string> = {};
  private ports: Record<string, number> = {};
  private tempVolumes: Record<string, string> = {};
  private deleteOnFinish = false;

  private entryPoint: string;
  public runAway: boolean = false;
  public evict: boolean = false;
  public interactive: boolean = false;
  public tty: boolean = false;
  public daemon: boolean = false;

  public volumes: Record<string, string> = {};
  public workingDir: string;

  constructor(private image: string, container?: string) {
    this.container = DockerContainer.getContainerName(image, container);
  }

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

  private runCmd(op: 'create' | 'run' | 'start' | 'stop' | 'exec', ...args: any[]) {
    const state = ExecUtil.spawn(this.dockerCmd, [op, ...(args ?? [])], { shell: this.tty });
    return (op !== 'run' && op !== 'exec') ? this.watchForEviction(state, true) : state;
  }

  get id() {
    const first = this.pendingExecutions.size > 0 ? this.pendingExecutions.values().next().value : undefined;
    return first && !first.process.killed ? first.process.pid : -1;
  }

  forceDestroyOnShutdown() {
    ShutdownManager.onShutdown(this.container, () => this.forceDestroy());
    return this;
  }

  setDeleteOnFinish(yes: boolean) {
    this.deleteOnFinish = yes;
    return this;
  }

  createTempVolume(volume: string) {
    const p = fs.mkdtempSync(`/tmp/${this.image.replace(/[^A-Za-z0-9]/g, '_')}`);
    this.tempVolumes[volume] = p;
    return this;
  }

  getTempVolumePath(volume: string) {
    return this.tempVolumes[volume];
  }

  exposePort(port: number, internalPort = port) {
    this.ports[port] = internalPort;
    return this;
  }

  addEnvVar(key: string, value: string = '') {
    this.env[key] = value;
    return this;
  }

  addEnvVars(vars: Record<string, string>) {
    Object.assign(this.env, vars);
    return this;
  }

  addVolume(local: string, container: string) {
    this.volumes[local] = container;
    return this;
  }

  setWorkingDir(container: string) {
    this.workingDir = container;
    return this;
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    return this;
  }

  setTTY(on: boolean) {
    this.tty = on;
    return this;
  }

  setEntryPoint(point: string) {
    this.entryPoint = point;
    return this;
  }

  setDaemon(on: boolean) {
    this.daemon = on;
    return this;
  }

  getRuntimeFlags(extra?: string[]) {
    const flags = [];
    if (this.interactive) {
      flags.push('-i');
    }
    if (this.tty) {
      flags.push('-t');
    }
    for (const k of Object.keys(this.env)) {
      if (this.env[k] === '') {
        flags.push('-e', k);
      } else {
        flags.push('-e', `${k}=${this.env[k]}`);
      }
    }
    flags.push(...(extra ?? []));
    return flags;
  }

  getFlags(extra?: string[]) {
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
    for (const k of Object.keys(this.volumes)) {
      flags.push('-v', `${k}:${this.volumes[k]}`);
    }
    for (const k of Object.keys(this.tempVolumes)) {
      flags.push('-v', `${this.tempVolumes[k]}:${k}`);
    }
    for (const k of Object.keys(this.ports)) {
      flags.push('-p', `${k}:${this.ports[k]}`);
    }

    flags.push(...this.getRuntimeFlags(extra));

    return flags;
  }

  async initTemp() {
    await Promise.all( // Make temp dirs
      Object.keys(this.tempVolumes).map(x => FsUtil.mkdirp(x)));
  }

  async create(args?: string[], flags?: string[]) {
    const allFlags = this.getFlags(flags);
    return this.runCmd('create', '--name', this.container, ...allFlags, this.image, ...(args ?? [])).result;
  }

  async start(args?: string[], flags?: string[]) {
    await this.initTemp();
    return this.runCmd('start', ...(flags ?? []), this.container, ...(args ?? [])).result;
  }

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

  exec(args?: string[], extraFlags?: string[]) {
    const flags = this.getRuntimeFlags(extraFlags);
    const execState = this.runCmd('exec', ...flags, this.container, ...(args ?? []));
    this.pendingExecutions.add(execState);

    execState.result = execState.result.finally(() => this.pendingExecutions.delete(execState));

    return execState;
  }

  async run(args?: any[], flags?: string[]) {

    if (!this.deleteOnFinish) {
      // Kill existing
      await this.destroy();
      await this.removeDanglingVolumes();
    }

    await this.initTemp();

    const execState = this.runCmd('run', `--name=${this.container}`, ...this.getFlags(flags), this.image, ...(args ?? []));
    this.pendingExecutions.add(execState);

    this.watchForEviction(execState);
    execState.process.unref();

    return execState.result.finally(() => this.pendingExecutions.delete(execState));
  }

  async validate() {
    return !this.runAway;
  }

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

  async cleanup() {
    console.debug('Cleaning', this.image, this.container);

    await Promise.all(
      Object.keys(this.tempVolumes)
        .map(x => FsUtil.unlinkRecursive(x, true))
    );
  }

  cleanupSync() {
    console.debug('Cleaning', this.image, this.container);

    for (const vol of Object.keys(this.tempVolumes)) {
      FsUtil.unlinkRecursiveSync(vol, true);
    }
  }

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