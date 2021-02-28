import { color } from './color';
import * as commander from 'commander';

/**
 * Utilities for formatting help
 */
export class HelpUtil {

  /**
   * Extract key from the text
   * @param text Source text
   * @param key
   */
  static extractValue(text: string, key: string) {
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

  /**
   * Colorize command section
   */
  static colorizeCommands(commands: string) {
    return commands
      .replace(/\s([^\[\]]\S+)/g, param => color`${{ param }}`)
      .replace(/(\s*[^\x1b]\[[^\]]+\])/g, input => color`${{ input }}`) // eslint-disable-line no-control-regex
      .replace(/Commands:/, title => color`${{ title }}`);
  }

  /**
   * Colorize usage
   */
  static colorizeUsage(usage: string) {
    return usage.replace(/Usage:/, title => color`${{ title }}`);
  }

  /**
   * Get full help text
   */
  static getHelpText(text: string, extraText?: string) {
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
      console!.error(color`${{ failure: message }}\n`);
    }
    command.outputHelp(text => HelpUtil.getHelpText(text, extra));
    process.exit(message ? 1 : 0);
  }
}