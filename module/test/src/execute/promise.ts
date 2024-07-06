import { createHook, executionAsyncId } from 'node:async_hooks';

import { ExecutionError } from '@travetto/worker';
import { Util } from '@travetto/base';

/**
 * Promise watcher, to catch any unfinished promises
 */
export class PromiseCapturer {
  #pending = new Map<number, Promise<unknown>>();
  #id: number = 0;

  #init(id: number, type: string, triggerId: number, resource: unknown): void {
    if (this.#id && type === 'PROMISE' && triggerId === this.#id) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.#pending.set(id, resource as Promise<unknown>);
    }
  }

  #promiseResolve(asyncId: number): void {
    this.#pending.delete(asyncId);
  }

  async run(op: () => Promise<unknown> | unknown): Promise<unknown> {
    const hook = createHook({
      init: (...args) => this.#init(...args),
      promiseResolve: (id) => this.#promiseResolve(id)
    });

    hook.enable();

    await Util.queueMacroTask();
    this.#id = executionAsyncId();
    try {
      const res = await op();
      if (this.#pending.size) {
        throw new ExecutionError(`Pending promises: ${this.#pending.size}`);
      }
      return res;
    } finally {
      hook.disable();
    }
  }
}