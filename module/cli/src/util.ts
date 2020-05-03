import * as commander from 'commander';

// Imported individually to prevent barrel import loading too much
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';

import { color } from './color';

/**
 * Completion interface
 */
export interface CompletionConfig {
  /**
   * All top level commands
   */
  all: string[];
  /**
   * Flags for sub tasks
   */
  task: {
    [key: string]: {
      [key: string]: string[];
    };
  };
}

/**
 * Common CLI Utilities
 */
export class CliUtil {
  static program = commander;

  static BOOLEAN_RE = /^(1|0|yes|no|on|off|auto|true|false)$/i;
  static TRUE_RE = /^(1|yes|on|true)$/i;

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
   * Extract key from the text
   * @param text Source text
   * @param key
   */
  static extractValue(text: string, key: string) {
    let sub;
    if (text.includes(key)) {
      const start = text.indexOf(key);
      let end = text.indexOf('\n\n', start);
      if (end < 0) {
        end = text.length;
      }
      sub = text.substring(start, end);
      text = text.substring(end);
    }
    return sub;
  }

  /**
   * Colorize Usage
   */
  static colorizeOptions(option: string) {
    return option.replace(/(\s*)(-[^, ]+)(,?\s*)(--\S+)?((\s+)?((?:\[[^\]]+\])|(?:\<[^>]+>)))?((\s+)(.*))?/g, (
      p: string, spacing: string,
      simpleParam: string, pSep: string,
      fullParam: string, sub: string,
      subSp: string, subVal: string,
      desc: string, descSp: string,
      descVal: string
    ) => {
      const line: string[] = [];
      line.push(
        spacing,
        color`${{ param: simpleParam }}`,
        pSep,
        color`${{ param: fullParam }}`,
        subSp,
        color`${{ type: subVal }}`,
        descSp,
        color`${{ description: descVal }}`
          .replace(/(\(default:\s+)(.*?)(\))/g,
            (__, l, input, r) => color`${l}${{ input }}${{ description: r }}`)
      );

      return line.filter(x => !!x).join('');
    })
      .replace(/Options:/, title => color`${{ title }}`);
  }

  static colorizeCommands(commands: string) {
    return commands
      .replace(/\s([^\[\]]\S+)/g, param => color`${{ param }}`)
      .replace(/(\s*[^\x1b]\[[^\]]+\])/g, input => color`${{ input }}`) // eslint-disable-line no-control-regex
      .replace(/Commands:/, title => color`${{ title }}`);
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

    cmd.outputHelp(text => {
      const usage = this.extractValue(text, 'Usage:');
      const options = this.extractValue(text, 'Options:');
      const commands = this.extractValue(text, 'Commands:');

      const out: string = [
        usage ? usage.replace(/Usage:/, title => color`${{ title }}`) : '',
        options ? this.colorizeOptions(options) : '',
        commands ? this.colorizeCommands(commands) : '',
        text
      ]
        .map(x => x.trim())
        .filter(x => !!x)
        .join('\n\n');

      return `${out}\n`;
    });
    process.exit(code);
  }
}