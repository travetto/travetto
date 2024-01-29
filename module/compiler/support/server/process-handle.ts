import fs from 'node:fs/promises';
import path from 'node:path';
import timers from 'node:timers/promises';

import type { ManifestContext } from '@travetto/manifest';

export class ProcessHandle {

  #file: string;

  constructor(ctx: ManifestContext, name: string) {
    this.#file = path.resolve(ctx.workspace.path, ctx.build.toolFolder, `${name}.pid`);
  }

  writePid(pid: number): Promise<void> {
    return fs.writeFile(this.#file, JSON.stringify(pid), 'utf8');
  }

  getPid(): Promise<number | undefined> {
    return fs.readFile(this.#file, 'utf8').then(v => +v, () => undefined);
  }

  async isRunning(): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) { return false; }
    try {
      process.kill(pid, 0); // See if process is still running
      return false;
    } catch { }
    return true; // Still running
  }

  async kill(): Promise<boolean> {
    const pid = await this.getPid();
    if (pid && await this.isRunning()) {
      try {
        return process.kill(pid);
      } catch { }
    }
    return false;
  }

  async ensureKilled(gracePeriod: number = 3000): Promise<boolean> {
    const start = Date.now();
    const pid = await this.getPid();
    while (pid && (Date.now() - start) < gracePeriod) { // Ensure its done
      if (!await this.isRunning()) {
        return true;
      }
      await timers.setTimeout(100);
    }
    try {
      pid && process.kill(pid); // Force kill
    } catch { }
    return pid !== undefined;
  }
}
