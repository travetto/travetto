import { isPromise } from 'node:util/types';
import { createHook, executionAsyncId } from 'node:async_hooks';

import { TimeSpan, TimeUtil, Util } from '@travetto/runtime';

import { ExecutionError, TimeoutError } from './error.ts';

const UNCAUGHT_ERR_EVENTS = ['unhandledRejection', 'uncaughtException'] as const;

export class Barrier {
  /**
   * Track timeout
   */
  static timeout(duration: number | TimeSpan, op: string = 'Operation'): { promise: Promise<void>, resolve: () => unknown } {
    const resolver = Util.resolvablePromise();
    const durationMs = TimeUtil.asMillis(duration);
    let timeout: NodeJS.Timeout;
    if (!durationMs) {
      resolver.resolve();
    } else {
      const msg = `${op} timed out after ${duration}${typeof duration === 'number' ? 'ms' : ''}`;
      timeout = setTimeout(() => resolver.reject(new TimeoutError(msg)), durationMs).unref();
    }

    resolver.promise.finally(() => { clearTimeout(timeout); });
    return resolver;
  }

  /**
   * Track uncaught error
   */
  static uncaughtErrorPromise(): { promise: Promise<void>, resolve: () => unknown } {
    const uncaught = Util.resolvablePromise<void>();
    const onError = (err: Error): void => { Util.queueMacroTask().then(() => uncaught.reject(err)); };
    UNCAUGHT_ERR_EVENTS.map(k => process.on(k, onError));
    uncaught.promise.finally(() => { UNCAUGHT_ERR_EVENTS.map(k => process.off(k, onError)); });
    return uncaught;
  }

  /**
   * Promise capturer
   */
  static capturePromises(): { start: () => Promise<void>, finish: () => Promise<void>, cleanup: () => void } {
    const pending = new Map<number, Promise<unknown>>();
    let id: number = 0;

    const hook = createHook({
      init(asyncId, type, triggerAsyncId, resource) {
        if (id && type === 'PROMISE' && triggerAsyncId === id && isPromise(resource)) {
          pending.set(id, resource);
        }
      },
      promiseResolve(asyncId: number): void {
        pending.delete(asyncId);
      }
    });

    return {
      async start(): Promise<void> {
        hook.enable();
        await Util.queueMacroTask();
        id = executionAsyncId();
      },
      async finish(maxTaskCount = 5): Promise<void> {
        let i = maxTaskCount; // Wait upto 5 macro tasks before continuing
        while (pending.size) {
          await Util.queueMacroTask();
          i -= 1;
          if (i === 0) {
            throw new ExecutionError(`Pending promises: ${pending.size}`);
          }
        }
      },
      cleanup(): void {
        hook.disable();
      }
    };
  }

  /**
   * Wait for operation to finish, with timeout and unhandled error support
   */
  static async awaitOperation(timeout: number | TimeSpan, op: () => Promise<unknown>): Promise<Error | undefined> {
    const uncaught = this.uncaughtErrorPromise();
    const timer = this.timeout(timeout);
    const promises = this.capturePromises();

    try {
      await promises.start();
      let capturedError: Error | undefined;
      const opProm = op().then(() => promises.finish());

      await Promise.race([opProm, uncaught.promise, timer.promise]).catch(err => capturedError ??= err);

      return capturedError;
    } finally {
      promises.cleanup();
      timer.resolve();
      uncaught.resolve();
    }
  }
}