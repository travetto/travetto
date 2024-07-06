import { createHook } from 'node:async_hooks';

import { ExecutionError } from '@travetto/worker';

const PENDING = Symbol.for('@travetto/test:promise-pending');

/**
 * Promise watcher, to catch any unfinished promises
 */
export class PromiseCapture {
  static #pending: Promise<unknown>[] = [];
  static #hook = createHook({
    init(id, type, triggerId, resource) {
      if (type === 'PROMISE') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        PromiseCapture.#pending.push(resource as Promise<unknown>);
      }
    }
  });

  /**
   * Track promise creation
   */
  static start(): void {
    this.#hook.enable();
  }

  /**
   * Stop the capture
   */
  static async stop(): Promise<void> {
    this.#hook.disable();

    const all = await Promise.all(this.#pending.map(val =>
      Promise.race([val, PENDING])
        .then(v => v === PENDING ? val : undefined)
        .catch(() => val)
    ));
    this.#pending = [];

    const pending = all.filter(x => !!x);
    if (pending.length) {
      console.debug('Resolving', { pending: pending.length });
      const results = await Promise.allSettled(pending);
      const final: Error | undefined = results.find(v => v.status === 'rejected')?.reason;

      // If any return in an error, make that the final result
      throw new ExecutionError(`Pending promises: ${pending.length}`, final?.stack);
    }
  }
}