import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import { Log, type Logger } from '../log.ts';
import { CommonUtil } from '../common.ts';

export class ProcessHandle {

  #file: string;
  #log: Logger;

  constructor(ctx: ManifestContext, name: string) {
    this.#file = CommonUtil.resolveWorkspace(ctx, ctx.build.toolFolder, `${name}.pid`);
    this.#log = Log.scoped(`process-handle.${name}`);
  }

  async writePidFile(processId: number): Promise<void> {
    await fs.mkdir(path.dirname(this.#file), { recursive: true });
    return fs.writeFile(this.#file, JSON.stringify(processId), 'utf8');
  }

  getProcessId(): Promise<number | undefined> {
    return fs.readFile(this.#file, 'utf8')
      .then(processId => +processId > 0 ? +processId : undefined, () => undefined);
  }

  async isRunning(): Promise<boolean> {
    const processId = await this.getProcessId();
    if (!processId) { return false; }
    try {
      process.kill(processId, 0); // See if process is still running
      this.#log.debug('Is running', processId);
      return true;
    } catch {
      this.#log.debug('Is not running', processId);
    }
    return false; // Not running
  }

  async kill(): Promise<boolean> {
    const processId = await this.getProcessId();
    if (processId && await this.isRunning()) {
      try {
        this.#log.debug('Killing', processId);
        return process.kill(processId);
      } catch { }
    }
    return false;
  }

  async ensureKilled(gracePeriod: number = 3000): Promise<boolean> {
    const start = Date.now();
    const processId = await this.getProcessId();
    if (!processId) {
      return false;
    }

    this.#log.debug('Ensuring Killed', processId);
    while ((Date.now() - start) < gracePeriod) { // Ensure its done
      if (!await this.isRunning()) {
        return true;
      }
      await CommonUtil.blockingTimeout(100);
    }
    try {
      this.#log.debug('Force Killing', processId);
      process.kill(processId); // Force kill
    } catch { }
    this.#log.debug('Did Kill', this.#file, !!processId);
    return true;
  }
}
