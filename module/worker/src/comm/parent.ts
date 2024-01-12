import { ChildProcess } from 'node:child_process';

import { ShutdownManager } from '@travetto/base';

import { ProcessCommChannel } from './channel';

/**
 * Parent channel
 */
export class ParentCommChannel<U = unknown> extends ProcessCommChannel<ChildProcess, U> {

  #complete: Promise<void>;

  constructor(proc: ChildProcess) {
    super(proc);
    ShutdownManager.onGracefulShutdown(() => this.destroy(), this);
    this.#complete = new Promise<void>(r => proc.on('close', r)).finally(() => { this.proc = undefined; });
  }

  /**
   * Kill self and child
   */
  override async destroy(): Promise<void> {
    const res = super.destroy();
    await this.#complete;
    return await res;
  }
}