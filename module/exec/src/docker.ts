import * as child_process from 'child_process';
import * as fs from 'fs';
import * as util from 'util';

import { Shutdown, ScanFs, ScanEntry, Env, FsUtil } from '@travetto/base';

import { ExecUtil } from './util';

const fsWriteFile = util.promisify(fs.writeFile);
const fsUnlink = util.promisify(fs.unlink);

function execSync(command: string) {
  console.debug('execSync', command);
  return child_process.execSync(command).toString().trim();
}

export class DockerContainer {

  private static getContainerName(image: string, container?: string) {
    return container || `${Env.get('DOCKER_NS', image)}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
  }

  private cmd: string = 'docker';
  private _proc: child_process.ChildProcess;

  private container: string;
  private env: { [key: string]: string } = {};
  private ports: { [key: string]: number } = {};
  private tempVolumes: { [key: string]: string } = {};
  private deleteOnFinish = false;

  private entryPoint: string;
  public runAway: boolean = false;
  public evict: boolean = false;
  public interactive: boolean = false;
  public tty: boolean = false;
  public daemon: boolean = false;

  public volumes: { [key: string]: string } = {};
  public workingDir: string;

  constructor(private image: string, container?: string) {
    this.container = DockerContainer.getContainerName(image, container);
  }

  private _cmd(op: 'create' | 'run' | 'start' | 'stop' | 'exec', ...args: any[]) {
    const [proc, prom] = ExecUtil.spawn(this.cmd, [op, ...(args || [])], { shell: this.tty });
    if (op !== 'run' && op !== 'exec') {
      prom.catch(e => { this.evict = true; });
    }
    return { proc, prom };
  }

  forceDestroyOnShutdown() {
    Shutdown.onShutdown(this.container, () => this.forceDestroy());
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

  get pid() {
    return this._proc !== undefined ? this._proc.pid : -1;
  }

  exposePort(port: number, internalPort = port) {
    this.ports[port] = internalPort;
    return this;
  }

  addEnvVar(key: string, value: string) {
    this.env[key] = value;
    return this;
  }

  addEnvVars(vars: { [key: string]: string }) {
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

  getFlags(extra?: string[]) {
    const flags = [];
    if (this.workingDir) {
      flags.push('-w', this.workingDir);
    }
    if (this.deleteOnFinish) {
      flags.push('--rm');
    }
    if (this.interactive) {
      flags.push('-i');
    }
    if (this.tty) {
      flags.push('-t');
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
    for (const k of Object.keys(this.env)) {
      flags.push('-e', `"${k}=${this.env[k]}"`);
    }

    if (extra) {
      flags.push(...extra);
    }
    return flags;
  }

  async initTemp() {
    // Make temp dirs
    const mkdirAll = Object.keys(this.tempVolumes).map(x => FsUtil.mkdirp(x).catch(e => { }));
    await Promise.all(mkdirAll);
  }

  async create(flags?: string[], args?: string[]) {
    const allFlags = this.getFlags(flags);
    return this._cmd('create', '--name', this.container, ...allFlags, this.image, ...(args || [])).prom;
  }

  async start(flags?: string[], args?: string[]) {
    await this.initTemp();
    return this._cmd('start', ...(flags || []), this.container, ...(args || [])).prom;
  }

  async stop(flags?: string[], args?: string[]) {
    return this._cmd('stop', ...(flags || []), this.container, ...(args || [])).prom;
  }

  exec(flags?: string[], args?: string[]) {
    const { proc, prom } = this._cmd('exec', ...(flags || []), this.container, ...(args || []));
    this._proc = proc;
    prom.catch(e => {
      delete this._proc;
    }).then(v => {
      delete this._proc;
    });
    return [proc, prom] as [typeof proc, typeof prom];
  }

  async run(...args: any[]) {

    if (!this.deleteOnFinish) {
      // Kill existing
      await this.destroy();
      await this.removeDanglingVolumes();
    }

    await this.initTemp();

    try {
      const { proc, prom } = this._cmd('run', `--name=${this.container}`, ...this.getFlags(), this.image, ...(args || []));
      proc.unref();
      this._proc = proc;
      return prom;
    } catch (e) {
      if (e.killed) {
        this.evict = true;
      }
      throw e;
    }
  }

  async validate() {
    return !this.runAway;
  }

  async destroy(runAway: boolean = false) {
    console.debug('Destroying', this.image, this.container);
    this.runAway = this.runAway || runAway;

    try {
      const [, res] = ExecUtil.spawn(this.cmd, ['kill', this.container]);
      await res;
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      const [, res] = ExecUtil.spawn(this.cmd, ['rm', '-fv', this.container]);
      await res;
    } catch (e) { /* ignore */ }

    delete this._proc;

    await this.cleanup();
  }

  async rimraf(pth: string) {
    const files = await ScanFs.scanDir({}, pth);
    for (const filter of [
      ScanFs.isNotDir,
      (x: ScanEntry) => x.stats.isDirectory()
    ]) {
      await Promise.all(files
        .filter(filter)
        .map(x => fsUnlink(x.file)
          .catch(e => { console.error(`Unable to delete ${e.file}`); }))
      );
    }
  }

  forceDestroy() {
    try {
      execSync(`${this.cmd} kill ${this.container}`);
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      execSync(`${this.cmd} rm -fv ${this.container}`);
    } catch (e) { /* ignore */ }

    this.cleanup();

    const ids = execSync(`${this.cmd} volume ls -qf dangling=true`);
    if (ids) {
      execSync(`${this.cmd} volume rm ${ids.split('\n').join(' ')}`);
    }
  }

  async writeFiles(dir: string, files?: { name: string, content: string }[]) {
    await this.cleanup();
    if (files) {
      for (const { name, content } of files) {
        const f = FsUtil.joinUnix(dir, name);
        await fsWriteFile(f, content, { mode: '755' });
      }
    }
    return;
  }

  async cleanup() {
    console.debug('Cleaning', this.image, this.container);
    const temps = Object.keys(this.tempVolumes).map(x => this.rimraf(x).catch((e: any) => { }));
    await Promise.all(temps);
  }

  async removeDanglingVolumes() {
    try {
      const [, res] = ExecUtil.spawn(this.cmd, ['volume', 'ls', '-qf', 'dangling=true']);
      const ids = (await res).stdout.trim();
      if (ids) {
        const [, volRmRes] = ExecUtil.spawn(this.cmd, ['volume', 'rm', ...ids.split('\n')]);
        await volRmRes;
      }
    } catch (e) {
      // error
    }
  }
}