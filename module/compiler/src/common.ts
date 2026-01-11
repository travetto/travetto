import { setMaxListeners } from 'node:events';
import timers from 'node:timers/promises';

import { type ManifestContext, path } from '@travetto/manifest';

import { Log } from './log.ts';

export class CommonUtil {

  /**
   * Restartable Event Stream
   */
  static async * restartableEvents<T>(input: (signal: AbortSignal) => AsyncIterable<T>, parent: AbortSignal, shouldRestart: (item: T) => boolean): AsyncIterable<T> {
    const log = Log.scoped('event-stream');
    outer: while (!parent.aborted) {
      const controller = new AbortController();
      setMaxListeners(1000, controller.signal);
      // Chain
      const kill = (): void => controller.abort();
      parent.addEventListener('abort', kill);

      const stream = input(controller.signal);

      log.debug('Started event stream');

      // Wait for all events, close at the end
      for await (const event of stream) {
        yield event;
        if (shouldRestart(event)) {
          log.debug('Restarting stream');
          controller.abort(); // Ensure terminated of process
          parent.removeEventListener('abort', kill);
          continue outer;
        }
      }

      log.debug('Finished event stream');

      // Natural exit, we done
      if (!controller.signal.aborted) { // Shutdown source if still running
        controller.abort();
      }
      return;
    }
  }

  /**
   * Non-blocking timeout
   */
  static nonBlockingTimeout(time: number): Promise<void> {
    return timers.setTimeout(time, undefined, { ref: false }).catch(() => { });
  }

  /**
   * Blocking timeout
   */
  static blockingTimeout(time: number): Promise<void> {
    return timers.setTimeout(time, undefined, { ref: true }).catch(() => { });
  }

  /**
   * Queue new macro task
   */
  static queueMacroTask(): Promise<void> {
    return timers.setImmediate(undefined);
  }

  /**
   * Resolve path for workspace, ensuring posix compliant slashes
   */
  static resolveWorkspace(ctx: ManifestContext, ...args: string[]): string {
    return path.resolve(ctx.workspace.path, ...args);
  }

  /**
   * Write to stdout with backpressure handling
   */
  static async writeStdout(level: number, data: unknown): Promise<void> {
    if (data === undefined) { return; }
    process.stdout.write(`${JSON.stringify(data, undefined, level)}\n`) ||
      await new Promise(resolve => process.stdout.once('drain', resolve));
  };
}