import { isPromise } from 'node:util/types';
import { createHook, executionAsyncId } from 'node:async_hooks';

import { type TimeSpan, TimeUtil, Util } from '@travetto/runtime';

import { TestExecutionError, TimeoutError } from '../model/error.ts';

const UNCAUGHT_ERR_EVENTS = ['unhandledRejection', 'uncaughtException'] as const;

export class Barrier {
  /**
   * Track timeout
   */
  static timeout(duration: number | TimeSpan, operation: string = 'Operation'): { promise: Promise<void>, resolve: () => unknown } {
    const resolver = Promise.withResolvers<void>();
    const durationMs = TimeUtil.duration(duration, 'ms');
    let timeout: NodeJS.Timeout;
    if (!durationMs) {
      resolver.resolve();
    } else {
      const msg = `${operation} timed out after ${duration}${typeof duration === 'number' ? 'ms' : ''}`;
      timeout = setTimeout(() => resolver.reject(new TimeoutError(msg)), durationMs).unref();
    }

    resolver.promise.finally(() => { clearTimeout(timeout); });
    return resolver;
  }

  /**
   * Track uncaught error
   */
  static uncaughtErrorPromise(): { promise: Promise<void>, resolve: () => unknown } {
    const uncaught = Promise.withResolvers<void>();
    const onError = (error: Error): void => { Util.queueMacroTask().then(() => uncaught.reject(error)); };
    UNCAUGHT_ERR_EVENTS.map(key => process.on(key, onError));
    uncaught.promise.finally(() => { UNCAUGHT_ERR_EVENTS.map(key => process.off(key, onError)); });
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
            throw new TestExecutionError(`Pending promises: ${pending.size}`);
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
  static async awaitOperation(timeout: number | TimeSpan, operation: () => Promise<unknown>): Promise<Error | undefined> {
    const uncaught = this.uncaughtErrorPromise();
    const timer = this.timeout(timeout);
    const promises = this.capturePromises();

    try {
      await promises.start();
      let capturedError: Error | undefined;
      const opProm = operation().then(() => promises.finish());

      await Promise.race([opProm, uncaught.promise, timer.promise]).catch(error => capturedError ??= error);

      return capturedError;
    } finally {
      promises.cleanup();
      timer.resolve();
      uncaught.resolve();
    }
  }
}