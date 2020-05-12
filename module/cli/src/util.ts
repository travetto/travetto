import * as commander from 'commander';

// Imported individually to prevent barrel import loading too much
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';

import { CompletionConfig } from './types';
import { color } from './color';
import { HelpUtil } from './help';

/**
 * Common CLI Utilities
 */
export class CliUtil {
  static program = commander;

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
   * Show the help usage
   * @param cmd The commander object
   * @param msg The failure message
   * @param code The exit code
   */
  static showHelp(cmd: commander.Command, msg = '', code = msg === '' ? 0 : 1) {

    if (msg) {
      console.error(color`${{ failure: msg }}\n`);
    }

    cmd.outputHelp(text => HelpUtil.getHelpText(text));
    process.exit(code);
  }
}