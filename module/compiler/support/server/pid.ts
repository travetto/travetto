import fs from 'node:fs/promises';
import path from 'node:path';
import timers from 'node:timers/promises';

import type { ManifestContext } from '@travetto/manifest';

export class PidFile<K extends string = string> {

  #file: string;

  constructor(ctx: ManifestContext) {
    this.#file = path.resolve(ctx.workspace.path, ctx.build.toolFolder, 'compiler.pid');
  }

  async write(pids: Partial<Record<K, number>>): Promise<void> {
    await fs.writeFile(this.#file, JSON.stringify(pids), 'utf8');
  }

  async read(): Promise<Record<K, number>> {
    return JSON.parse(await fs.readFile(this.#file, 'utf8').catch(() => '{}'));
  }

  async getPid(key: K | number): Promise<number | undefined> {
    return typeof key === 'number' ? key : (await this.read())[key];
  }

  async isRunning(key: K | number): Promise<boolean> {
    const pid = await this.getPid(key);
    if (pid) {
      try {
        process.kill(pid, 0); // See if process is still running
      } catch {
        return true; // If not, its done
      }
    }
    return false;
  }

  async kill(): Promise<boolean> {
    let killed = false;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [, pid] of Object.entries(await this.read()) as [K, number][]) {
      if (await this.isRunning(pid)) {
        process.kill(pid);
        killed = true;
      }
    }
    return killed;
  }

  async ensureKilled(key: K | number, gracePeriod: number = 3000): Promise<void> {
    const start = Date.now();
    const pid = await this.getPid(key);
    while (pid && (Date.now() - start) < gracePeriod) { // Ensure its done
      if (!await this.isRunning(key)) {
        return;
      }
      await timers.setTimeout(100);
    }
    pid && process.kill(pid); // Force kill
  }
}
