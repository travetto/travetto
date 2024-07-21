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
    if (!process.env.TRV_BUILD_REENTRANT && current && pid !== current && current > 0) {
      await this.kill(false);
    }
    await fs.mkdir(path.dirname(this.#file), { recursive: true });
    return fs.writeFile(this.#file, JSON.stringify(pid), 'utf8');
  }

  getPid(): Promise<number | undefined> {
    return fs.readFile(this.#file, 'utf8')
      .then(v => +v > 0 ? +v : undefined, () => undefined);
  }

  async isRunning(log = true): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) { return false; }
    try {
      process.kill(pid, 0); // See if process is still running
      log && this.#log.debug('Is running', pid);
      return true;
    } catch {
      log && this.#log.debug('Is not running', pid);
    }
    return false; // Not running
  }

  async kill(log = true): Promise<boolean> {
    const pid = await this.getPid();
    if (pid && await this.isRunning(log)) {
      try {
        log && this.#log.debug('Killing', pid);
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
