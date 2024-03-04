import fs from 'node:fs/promises';
import path from 'node:path';
import { setMaxListeners } from 'node:events';
import timers from 'node:timers/promises';

import { Log } from './log';

export class CommonUtil {
  /**
   * Determine file type
   */
  static getFileType(file: string): 'ts' | 'js' | 'package-json' | 'typings' | undefined {
    return file.endsWith('package.json') ? 'package-json' :
      (file.endsWith('.js') ? 'js' :
        (file.endsWith('.d.ts') ? 'typings' : (/[.]tsx?$/.test(file) ? 'ts' : undefined)));
  }

  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content, 'utf8'));

  /**
   * Restartable Event Stream
   */
  static async * restartableEvents<T>(src: (signal: AbortSignal) => AsyncIterable<T>, parent: AbortSignal, shouldRestart: (item: T) => boolean): AsyncIterable<T> {
    const log = Log.scoped('event-stream');
    outer: while (!parent.aborted) {
      const controller = new AbortController();
      setMaxListeners(1000, controller.signal);
      // Chain
      const kill = (): void => controller.abort();
      parent.addEventListener('abort', kill);

      const comp = src(controller.signal);

      log.debug('Started event stream');

      // Wait for all events, close at the end
      for await (const ev of comp) {
        yield ev;
        if (shouldRestart(ev)) {
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
   * Queue new macrotask
   */
  static queueMacroTask(): Promise<void> {
    return timers.setImmediate(undefined);
  }
}