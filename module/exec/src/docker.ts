import * as child_process from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

import { CommonProcess, ChildOptions } from './types';
import { spawn, WithOpts } from './util';
import { rimraf } from '@travetto/base';

const writeFile = util.promisify(fs.writeFile);
const mkTempDir = util.promisify(fs.mkdtemp);
const mkdir = util.promisify(fs.mkdir);

function exec(command: string, opts?: WithOpts<child_process.SpawnOptions>) {
  return spawn(command, { shell: false, ...opts })[1];
}

export class DockerContainer {

  private cmd: string = 'docker';
  private _proc: CommonProcess;

  private container: string;

  public runAway: boolean = false;
  public evict: boolean = false;

  public ports: { [key: string]: number } = {};
  public volumes: { [key: string]: string } = {};
  public workingDir: string;

  private tempVolumes: { [key: string]: string } = {}


  constructor(private image: string, container?: string) {
    this.container = container || `${image}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
  }

  async createTempVolume(volume: string) {
    const p = await mkTempDir(`/tmp/${this.image.replace(/[^A-Za-z0-9]/g, '_')}`);
    this.tempVolumes[p] = volume;
    return p;
  }

  mapVolume(local: string, volume: string) {
    this.volumes[local] = volume;
  }

  get pid() {
    return this._proc !== undefined ? this._proc.pid : -1;
  }

  async run(...args: string[]) {
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
      for (const k of Object.keys(this.volumes)) {
        finalArgs.push('-v', `${k}:${this.volumes[k]}`)
      }
      for (const k of Object.keys(this.tempVolumes)) {
        finalArgs.push('-v', `${k}:${this.tempVolumes[k]}`);
      }
      for (const k of Object.keys(this.ports)) {
        finalArgs.push('-p', `${k}:${this.ports[k]}`);
      }

      console.debug('Running', [...finalArgs, this.image, ...args]);

      [this._proc, prom] = spawn([...finalArgs, this.image, ...args].join(' '), { shell: false });
    } catch (e) {
      if (e.killed) {
        this.evict = true;
      }
      throw e;
    }

    return prom;
  }

  async validate() {
    return !this.runAway;
  }

  async destroy(runAway: boolean = false) {
    this.runAway = this.runAway || runAway;

    try {
      await exec(`${this.cmd} kill ${this.container}`);
    } catch (e) { /* ignore */ }

    try {
      await exec(`${this.cmd} rm -fv ${this.container}`);
    } catch (e) { /* ignore */ }

    await this.cleanup();
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