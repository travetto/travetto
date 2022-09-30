import * as commander from 'commander';

import { CliUtil } from '@travetto/boot/src/cli';
/**
 * Utilities for formatting help
 */
export class HelpUtil {

  /**
   * Extract key from the text
   * @param text Source text
   * @param key
   */
  static extractValue(text: string, key: string): readonly [string, string] {
    let sub = '';
    if (text.includes(key)) {
      const start = text.indexOf(key);
      let end = text.indexOf('\n\n', start);
      if (end < 0) {
        end = text.length;
      }
      sub = text.substring(start, end);
      text = text.substring(end);
    }
    return [sub, text] as const;
  }

  /**
   * Colorize Usage
   */
  static colorizeOptions(option: string): string {
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
        CliUtil.color`${{ param: simpleParam }}`,
        pSep,
        CliUtil.color`${{ param: fullParam }}`,
        subSp,
        CliUtil.color`${{ type: subVal }}`,
        descSp,
        CliUtil.color`${{ description: descVal }}`
          .replace(/(\(default:\s+)(.*?)(\))/g,
            (__, l, input, r) => CliUtil.color`${l}${{ input }}${{ description: r }}`)
      );

      return line.filter(x => !!x).join('');
    })
      .replace(/Options:/, title => CliUtil.color`${{ title }}`);
  }

  /**
   * Colorize command section
   */
  static colorizeCommands(commands: string): string {
    return commands
      .replace(/\s([^\[\]]\S+)/g, param => CliUtil.color`${{ param }}`)
      .replace(/(\s*[^\x1b]\[[^\]]+\])/g, input => CliUtil.color`${{ input }}`) // eslint-disable-line no-control-regex
      .replace(/Commands:/, title => CliUtil.color`${{ title }}`);
  }

  /**
   * Colorize usage
   */
  static colorizeUsage(usage: string): string {
    return usage.replace(/Usage:/, title => CliUtil.color`${{ title }}`);
  }

  /**
   * Get full help text
   */
  static getHelpText(text: string, extraText?: string): string {
    const [usage, text2] = this.extractValue(text, 'Usage:');
    const [options, text3] = this.extractValue(text2, 'Options:');
    const [commands, textFinal] = this.extractValue(text3, 'Commands:');

    const out: string = [
      this.colorizeUsage(usage),
      this.colorizeOptions(options),
      this.colorizeCommands(commands),
      textFinal
    ]
      .map(x => x.trim())
      .filter(x => !!x)
      .join('\n\n');

    return `${[out, extraText].filter(x => !!x).join('\n')}\n`;
  }

  /**
   * Show the help
   * @param command
   * @param message
   * @param extra
   */
  static showHelp(command: commander.Command, message?: string, extra?: string): never {
    if (message) {
      console!.error(CliUtil.color`${{ failure: message }}\n`);
    }
    console![message ? 'error' : 'log'](
      HelpUtil.getHelpText(command.helpInformation(), extra)
    );
    process.exit(message ? 1 : 0);
  }
}