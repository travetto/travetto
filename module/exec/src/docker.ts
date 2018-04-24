import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as child_process from 'child_process';

import { CommonProcess, ChildOptions, ExecutionResult } from './types';
import { spawn, WithOpts } from './util';
import { scanDir, Entry, rimraf } from '@travetto/base';

const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

function exec(command: string, opts?: WithOpts<child_process.SpawnOptions>) {
  return spawn(command, opts)[1];
}

export class DockerContainer {

  private tempDir: string = '/tmp';
  private volume: string = '/var/workspace';
  private cmd: string = 'docker';
  private _proc: CommonProcess;

  private workspace: string;
  private container: string;

  public runAway: boolean = false;
  public evict: boolean = false;

  constructor(private image: string, container?: string) {
    this.container = container || `${image}-${Date.now()}-${Math.random()}`.replace(/[^A-Z0-9a-z\-]/g, '');
    this.workspace = `${this.tempDir}/${this.container}`;
  }

  get pid() {
    return this._proc !== undefined ? this._proc.pid : -1;
  }

  async create() {
    // Kill existing
    await this.destroy();
    await this.removeDanglingVolumes();

    try {
      await mkdir(this.workspace);
    } catch (e) { /* ignore */ }

    try {
      await exec(`${this.cmd} create --name=${this.container} -it -v ${this.workspace}:${this.volume} -w ${this.volume} ${this.image}`);
      await exec(`${this.cmd} start ${this.container}`);
    } catch (e) {
      throw e;
    }
    return this;
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

  async exec(cmd: string, options: ChildOptions = {}) {
    try {
      const [proc, prom] = spawn(`${this.cmd} exec ${this.container} ${cmd}`, options)
      this._proc = proc;
      await prom;
    } catch (e) {
      if (e.killed) {
        this.evict = true;
      }
    }
  }

  async initRun(files?: { name: string, content: string }[]) {
    await this.cleanup();
    if (files) {
      for (const { name, content } of files) {
        const f = [this.workspace, name].join(path.sep);
        await writeFile(f, content, { mode: '755' });
      }
    }
    return;
  }

  async cleanup() {
    try {
      await rimraf(`${this.workspace}/*`);
    } catch (e) { /* ignore */ }
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