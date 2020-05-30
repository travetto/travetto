import * as readline from 'readline';
// Imported individually to prevent barrel import loading too much
import { FsUtil } from '@travetto/boot/src/fs';
import { EnvUtil } from '@travetto/boot/src/env';
import { ExecUtil } from '@travetto/boot/src/exec';

import { CompletionConfig } from './types';

type AppEnv = {
  env?: string;
  watch?: string;
  debug?: string;
  roots?: string[];
  resourceRoots?: string[];
  profiles?: string[];
};

/**
 * Common CLI Utilities
 */
export class CliUtil {

  static WAIT_STATE = `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`.split('');

  static isBoolean(x: string) {
    return /^(1|0|yes|no|on|off|auto|true|false)$/i.test(x);
  }

  static isTrue(x: string) {
    return /^(1|yes|on|true)$/i.test(x);
  }

  /**
   * Platform aware file opening
   */
  static launch(path: string) {
    const op = process.platform === 'darwin' ? ['open', path] :
      process.platform === 'win32' ? ['cmd', '/c', 'start', path] :
        ['xdg-open', path];

    ExecUtil.spawn(op[0], op.slice(1));
  }

  /**
   * Get code completion values
   */
  static async getCompletion(compl: CompletionConfig, args: string[]) {
    args = args.slice(0); // Copy as we mutate

    const cmd = args.shift()!;

    let last = cmd;
    let opts: string[] = [];

    // List all commands
    if (!compl.task[cmd]) {
      opts = compl.all;
    } else {
      // Look available sub commands
      last = args.pop() ?? '';
      const second = args.pop() ?? '';
      let flag = '';

      if (last in compl.task[cmd]) {
        flag = last;
        last = '';
      } else if (second in compl.task[cmd]) {
        // Look for available flags
        if (compl.task[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = compl.task[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  }

  /**
   * Initialize the app environment
   */
  static initAppEnv({ env, watch, roots, resourceRoots, profiles, debug }: AppEnv) {
    env = env ?? process.env.TRV_ENV ?? process.env.NODE_ENV ?? 'dev'; // Preemptively set b/c env changes how we compile some things
    process.env.TRV_ENV = env;
    process.env.NODE_ENV = /^prod/i.test(env) ? 'production' : 'development';
    process.env.TRV_WATCH = `${watch ? EnvUtil.getBoolean('TRV_WATCH') && !EnvUtil.isProd() : false}`;
    process.env.TRV_ROOTS = EnvUtil.getList('TRV_ROOTS', roots).join(',');
    process.env.TRV_RESOURCE_ROOTS = EnvUtil.getList('TRV_RESOURCE_ROOTS', resourceRoots).join(',');
    process.env.TRV_PROFILES = EnvUtil.getList('TRV_PROFILES', profiles).join(',');
    process.env.TRV_DEBUG = EnvUtil.get('TRV_DEBUG', EnvUtil.get('DEBUG', debug ?? (EnvUtil.isProd() ? '0' : '')));
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: NodeJS.WritableStream, text?: string, clear = false) {
    await new Promise(r => readline.cursorTo(stream, 0, undefined, () => {
      if (clear) {
        readline.clearLine(stream, 0);
      }
      if (text) {
        stream.write(text);
        readline.moveCursor(stream, 1, 0);
      }
      r();
    }));
  }

  /**
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  static async waiting(message: string, work: Promise<any>,
    config: { completion?: string, delay?: number, stream?: NodeJS.WritableStream } = {}
  ) {
    const { stream, delay, completion } = { delay: 250, stream: process.stderr, ...config };

    const writeLine = this.rewriteLine.bind(this, stream);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    let i = -1;
    let done = false;
    work.finally(() => done = true);
    await sleep(delay);
    while (!done) {
      await writeLine(`${this.WAIT_STATE[i = (i + 1) % this.WAIT_STATE.length]} ${message}`);
      await sleep(100);
    }

    if (i === -1) {
      return;
    }

    await writeLine(completion ? `${message} ${completion}\n` : '', true);
  }

  /**
   * Trigger a compile
   */
  static compile(output?: string) {
    return this.waiting('Compiling...',
      ExecUtil.worker('@travetto/compiler/bin/compile-target', [], {
        env: output ? { TRV_CACHE_DIR: output } : {},
        stderr: true,
        stdout: true
      }).result
    );
  }
}