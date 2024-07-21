import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';
import { Log, Logger } from '../log';
import { CommonUtil } from '../util';

export class ProcessHandle {

  #file: string;
  #log: Logger;

  constructor(ctx: ManifestContext, name: string) {
    this.#file = CommonUtil.resolveWorkspace(ctx, ctx.build.toolFolder, `${name}.pid`);
    this.#log = Log.scoped(`process-handle.${name}`);
  }

  async writePid(pid: number): Promise<void> {
    const current = await this.getPid();
    if (current && pid !== current && current > 0) {
      process.kill(current); // Kill before write
    }
    await fs.mkdir(path.dirname(this.#file), { recursive: true });
    return fs.writeFile(this.#file, JSON.stringify(pid), 'utf8');
  }

  getPid(): Promise<number | undefined> {
    return fs.readFile(this.#file, 'utf8')
      .then(v => +v > 0 ? +v : undefined, () => undefined);
  }

  async isRunning(): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) { return false; }
    try {
      process.kill(pid, 0); // See if process is still running
      this.#log.debug('Is running', pid);
      return true;
    } catch {
      this.#log.debug('Is not running', pid);
    }
    return false; // Not running
  }

  async kill(): Promise<boolean> {
    const pid = await this.getPid();
    if (pid && await this.isRunning()) {
      try {
        this.#log.debug('Killing', pid);
        return process.kill(pid);
      } catch { }
    }
    return false;
  }

  async ensureKilled(gracePeriod: number = 3000): Promise<boolean> {
    const start = Date.now();
    const pid = await this.getPid();
    if (!pid) {
      return false;
    }

    this.#log.debug('Ensuring Killed', pid);
    while ((Date.now() - start) < gracePeriod) { // Ensure its done
      if (!await this.isRunning()) {
        return true;
      }
      await CommonUtil.blockingTimeout(100);
    }
    try {
      this.#log.debug('Force Killing', pid);
      process.kill(pid); // Force kill
    } catch { }
    this.#log.debug('Did Kill', this.#file, !!pid);
    return true;
  }
}
