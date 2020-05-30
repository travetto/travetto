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
  static isBoolean(x: string) {
    return /^(1|0|yes|no|on|off|auto|true|false)$/i.test(x);
  }

  static isTrue(x: string) {
    return /^(1|yes|on|true)$/i.test(x);
  }

  /**
   * Allow the plugin to depend on another command by executing
   *
   * @param cmd The command to run
   * @param args The args to pass in
   * @param sCwd The root working directory
   */
  static async dependOn(cmd: string, args: string[] = [], sCwd: string = FsUtil.cwd) {
    await ExecUtil.fork(cmd, args, { cwd: sCwd, shell: true }).result;
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
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  static waiting(message: string, delay = 100, stream = process.stderr) {
    const state = `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`.split('');
    let i = 0;
    const tpl = `  ${message}`;
    stream.write(tpl);

    const id = setInterval(function () {
      readline.cursorTo(stream, 0, undefined, () => {
        stream.write(state[i = (i + 1) % state.length]);
        readline.cursorTo(stream, tpl.length + 1);
      });
    }, delay);

    return (text?: string) => {
      readline.cursorTo(stream, tpl.length + 1);
      if (text) {
        stream.write(` ${text}\n`);
      } else {
        readline.clearLine(stream, -1);
      }
      clearInterval(id);
    };
  }
}