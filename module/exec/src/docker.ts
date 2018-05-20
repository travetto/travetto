import * as child_process from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

import { CommonProcess, ChildOptions, ExecutionResult } from './types';
import { spawn, WithOpts } from './util';
import { Shutdown, rimraf, isPlainObject } from '@travetto/base';
import { CpuInfo } from 'os';

const writeFile = util.promisify(fs.writeFile);
const mkTempDir = util.promisify(fs.mkdtemp);
const mkdir = util.promisify(fs.mkdir);

function exec(command: string, opts?: WithOpts<child_process.SpawnOptions>) {
  return spawn(command, { shell: false, ...opts })[1];
}

function execSync(command: string) {
  console.debug('execSync', command);
  return child_process.execSync(command).toString().trim();
}

export class DockerContainer {

  private cmd: string = 'docker';
  private _proc: CommonProcess;

  private container: string;

  public runAway: boolean = false;
  public evict: boolean = false;
  public interactive: boolean = false;
  public tty: boolean = false;

  private env: { [key: string]: string } = {};
  private ports: { [key: string]: number } = {};
  public volumes: { [key: string]: string } = {};
  public workingDir: string;

  private tempVolumes: { [key: string]: string } = {}

  private deleteOnFinish = false;

  constructor(private image: string, container?: string) {
    this.container = container || `${process.env.DOCKER_NS || image}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
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

  async waitForPort(port: number, ms = 5000) {
    const start = Date.now()
    while ((Date.now() - start) < ms) {
      try {
        await new Promise((res, rej) => {
          try {
            const sock = net.createConnection(port, 'localhost', (err: any, succ: any) => {
              if (err) {
                rej(err);
              } else {
                sock.destroy();
                res(succ);
              }
            });
            sock.on('error', rej);
          } catch (e) {
            rej(e);
          }
        });
        return;
      } catch (e) {
        await new Promise(res => setTimeout(res, 50));
      }
    }
    throw new Error('Could not acquire port');
  }

  run(first: string, ...args: any[]): Promise<ExecutionResult>
  run(options: { args?: any[], flags?: string[] }): Promise<[CommonProcess, Promise<ExecutionResult>]>
  async run(...args: any[]): Promise<ExecutionResult | [CommonProcess, Promise<ExecutionResult>]> {
    const options = isPlainObject(args[0]) ? args[0] : {
      args
    };

    // Kill existing
    await this.destroy();
    await this.removeDanglingVolumes();

    // Make temp dirs
    const mkdirAll = Object.keys(this.tempVolumes).map(x => mkdir(x).catch(e => { }));
    await Promise.all(mkdirAll);

    let prom;

    try {
      const finalArgs = [this.cmd, 'run', `--name=${this.container}`];
      if (this.workingDir) {
        finalArgs.push('-w', this.workingDir);
      }
      if (this.deleteOnFinish) {
        finalArgs.push('--rm');
      }
      if (this.interactive) {
        finalArgs.push('-i');
      }
      if (this.tty) {
        finalArgs.push('-t');
      }
      for (const k of Object.keys(this.volumes)) {
        finalArgs.push('-v', `${k}:${this.volumes[k]}`)
      }
      for (const k of Object.keys(this.tempVolumes)) {
        finalArgs.push('-v', `${this.tempVolumes[k]}:${k}`);
      }
      for (const k of Object.keys(this.ports)) {
        finalArgs.push('-p', `${k}:${this.ports[k]}`);
      }
      for (const k of Object.keys(this.env)) {
        finalArgs.push('-e', `"${k}=${this.env[k]}"`);
      }

      if (options.flags) {
        finalArgs.push(...options.flags);
      }

      console.debug('Running', [...finalArgs, this.image, ...(options.args || [])]);

      [this._proc, prom] = spawn([...finalArgs, this.image, ...(options.args || []).map((z: any) => `${z}`)].join(' '), {
        shell: false,
      });

      this._proc.unref();
    } catch (e) {
      if (e.killed) {
        this.evict = true;
      }
      throw e;
    }

    if (isPlainObject(args[0])) {
      return [this._proc, prom];
    } else {
      return prom;
    }
  }

  async validate() {
    return !this.runAway;
  }

  async destroy(runAway: boolean = false) {
    console.debug('Destroying', this.image, this.container);
    this.runAway = this.runAway || runAway;

    try {
      await exec(`${this.cmd} kill ${this.container}`);
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      await exec(`${this.cmd} rm -fv ${this.container}`);
    } catch (e) { /* ignore */ }

    delete this._proc;

    await this.cleanup();
  }

  forceDestroy() {
    try {
      execSync(`${this.cmd} kill ${this.container}`);
    } catch (e) { /* ignore */ }

    console.debug('Removing', this.image, this.container);

    try {
      execSync(`${this.cmd} rm -fv ${this.container}`);
    } catch (e) { /* ignore */ }

    const temps = Object.keys(this.tempVolumes).map(x => rimraf(x).catch(e => { }));
    Promise.all(temps);

    const ids = execSync(`${this.cmd} volume ls -qf dangling=true`);
    if (ids) {
      execSync(`${this.cmd} volume rm ${ids.split('\n').join(' ')}`);
    }
  }

  async writeFiles(dir: string, files?: { name: string, content: string }[]) {
    await this.cleanup();
    if (files) {
      for (const { name, content } of files) {
        const f = [dir, name].join(path.sep);
        await writeFile(f, content, { mode: '755' });
      }
    }
    return;
  }

  async cleanup() {
    console.debug('Cleaning', this.image, this.container);
    const temps = Object.keys(this.tempVolumes).map(x => rimraf(x).catch(e => { }));
    await Promise.all(temps);
  }

  async removeDanglingVolumes() {
    try {
      const ids = (await exec(`${this.cmd} volume ls -qf dangling=true`)).stdout.trim();
      if (ids) {
        await exec(`${this.cmd} volume rm ${ids.split('\n').join(' ')}`);
      }
    } catch (e) {
      // error
    }
  }
}