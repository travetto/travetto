import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';
import timers from 'node:timers/promises';
import posix from 'node:path/posix';
import native from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import { Log } from './log.ts';

const toPosix = (file: string): string => file.replaceAll('\\', '/');

export class CommonUtil {
  /**
   * Determine file type
   */
  static getFileType(file: string): 'ts' | 'js' | 'package-json' | 'typings' | undefined {
    return file.endsWith('package.json') ? 'package-json' :
      (file.endsWith('.js') ? 'js' :
        (file.endsWith('.d.ts') ? 'typings' : (/[.][cm]?tsx?$/.test(file) ? 'ts' : undefined)));
  }

  /**
   * Write text file, and ensure folder exists
   */
  static writeTextFile = (file: string, content: string): Promise<void> =>
    fs.mkdir(native.dirname(file), { recursive: true }).then(() => fs.writeFile(file, content, 'utf8'));

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
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
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
    const all = [process.cwd(), ctx.workspace.path, ...args].map(toPosix);
    return process.platform === 'win32' ? toPosix(native.resolve(...all)) : posix.resolve(...all);
  }
}