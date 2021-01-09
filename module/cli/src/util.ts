import * as readline from 'readline';
import { parentPort } from 'worker_threads';
// Imported individually to prevent barrel import loading too much
import { EnvUtil } from '@travetto/boot/src/env';
import { ExecUtil } from '@travetto/boot/src/exec';

import { CompletionConfig } from './types';

export interface AppEnv {
  env?: string;
  watch?: boolean;
  debug?: string;
  roots?: string[];
  resourceRoots?: string[];
  profiles?: string[];
  envExtra?: Record<string, any>;
}

const join = (items: string[]) => [...new Set(items)].join(',');

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
  static initAppEnv({ env, watch, roots, resourceRoots, profiles, debug, envExtra }: AppEnv) {
    process.env.TRV_ENV = env ?? process.env.TRV_ENV ?? process.env.NODE_ENV ?? 'dev';
    Object.assign(process.env, envExtra ?? {}, {
      NODE_ENV: EnvUtil.isProd() ? 'production' : 'development',
      TRV_WATCH: `${watch === undefined ? EnvUtil.getBoolean('TRV_WATCH') : watch}`,
      TRV_RESOURCES: join(EnvUtil.getList('TRV_RESOURCES', resourceRoots)),
      TRV_PROFILES: join(EnvUtil.getList('TRV_PROFILES', profiles)),
      TRV_DEBUG: EnvUtil.get('TRV_DEBUG', EnvUtil.get('DEBUG', debug ?? (EnvUtil.isProd() ? '0' : '')))
    });
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: NodeJS.WritableStream, text?: string, clear = false) {
    await new Promise<void>(r => readline.cursorTo(stream, 0, undefined, () => {
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
  static async waiting<T>(message: string, work: Promise<T> | (() => Promise<T>),
    config: { completion?: string, delay?: number, stream?: NodeJS.WritableStream } = {}
  ) {
    const { stream, delay, completion } = { delay: 1000, stream: process.stderr, ...config };

    const writeLine = this.rewriteLine.bind(this, stream);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    if (!('then' in work)) {
      work = work();
    }

    if (!process.stdout.isTTY) {
      return work; // Dip early
    }

    let i = -1;
    let done = false;
    let value: T | undefined;
    let err: Error | undefined;
    const final = work
      .then(res => value = res)
      .catch(e => err = e)
      .finally(() => done = true);

    if (delay) {
      await Promise.race([sleep(delay), final]);
    }

    while (!done) {
      await writeLine(`${this.WAIT_STATE[i = (i + 1) % this.WAIT_STATE.length]} ${message}`);
      await sleep(50);
    }

    if (i >= 0) {
      await writeLine(completion ? `${message} ${completion}\n` : '', true);
    }
    if (err) {
      throw err;
    } else {
      return value!;
    }
  }

  /**
   * Return plugin data depending on how it has been called
   */
  static pluginResponse(obj: any) {
    parentPort ? parentPort.postMessage(obj) : console.log(JSON.stringify(obj));
    return obj;
  }
}