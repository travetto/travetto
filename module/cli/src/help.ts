import type * as commander from 'commander';

import { cliTpl } from './color';

const TYPE_PATTERN = /(\[[^\]]+\])/g;
const TITLE_PATTERN = /^(\S[^:]+:)/gim;

const OPTIONS_PATTERN = new RegExp([
  '^',
  '(?<space>[ ]+)',
  '(?<shortName>-[^, ]+)',
  '(?<paramSpace>,?[ ]*)?',
  '(?<longName>--\\S+)?',
  '((?<typeSpace>[ ]+)?(?<type>(?:\\[[^\\]]+\\])|(?:[<][^>]+[>])))?',
  '((?<descriptionSpace>[ ]+)(?<description>.*?))?',
  '((?<defaultPre>[ ]*[(])(?<defaultKey>default)(?<defaultSpace>: )(?<defaultValue>[^)]+)(?<defaultPost>[)]))?',
  '(?:[ ]+)?',
  '$',
].join(''), 'gim');

type OptionsGroup = {
  space: string; shortName: string;
  paramSpace?: string; longName?: string;
  typeSpace?: string; type?: string;
  descriptionSpace?: string;
  description?: string;
  defaultPre?: string; defaultKey?: string; defaultSpace?: string; defaultValue?: string; defaultPost?: string;
};

const COMMANDS_PATTERN = new RegExp([
  '^',
  '(?<space>[ ]+)',
  '(?<name>\\S+)',
  '(?<optionsSpace>[ ]+)?',
  '(?<options>\\[.*\\])?',
  '((?<descriptionSpace>[ ]+)(?<description>[a-z][^\\n\\[]+))?',
  '(?:[ ]+)?',
  '$',
].join(''), 'gim');

type CommandGroup = {
  space: string; name: string;
  optionsSpace?: string; options?: string;
  descriptionSpace?: string; description?: string;
};

const USAGE_PATTERN = new RegExp([
  '^',
  '(?<title>Usage:)',
  '(?<space>[ ]+)?',
  '(?<name>[^\\[ ]+)?',
  '(?<nameSpace>[ ]+)?',
  '(?<options>\\[.*\\])?',
  '(?:[ ]+)?',
  '$',
].join(''), 'gim');

type UsageGroup = {
  title: string; space?: string;
  name?: string; nameSpace?: string;
  options?: string;
};

function namedReplace<T>(text: string, pattern: RegExp, replacer: (data: T) => (string | (string | undefined)[])): string {
  return text.replace(pattern, (...args: unknown[]): string => {
    const groups = args[args.length - 1];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = replacer(groups as T);
    if (typeof res === 'string') {
      return res;
    } else {
      return res.filter(x => !!x).join('');
    }
  });
}

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
    return namedReplace<OptionsGroup>(option, OPTIONS_PATTERN,
      ({
        space, shortName, paramSpace, longName, typeSpace, type, descriptionSpace, description,
        defaultPre, defaultKey, defaultSpace, defaultValue, defaultPost
      }) =>
        [
          space,
          cliTpl`${{ param: shortName }}`,
          paramSpace,
          cliTpl`${{ param: longName }}`,
          typeSpace,
          cliTpl`${{ type }}`,
          descriptionSpace,
          cliTpl`${{ description }}`,
          defaultPre,
          cliTpl`${{ description: defaultKey }}`,
          defaultSpace,
          cliTpl`${{ input: defaultValue }}`,
          defaultPost
        ]
    )
      .replace(TITLE_PATTERN, title => cliTpl`${{ title }}`);
  }

  /**
   * Colorize command section
   */
  static colorizeCommands(commands: string): string {
    return namedReplace<CommandGroup>(commands, COMMANDS_PATTERN,
      ({ space, name, optionsSpace, options, descriptionSpace, description }) => [
        space,
        cliTpl`${{ param: name }}`,
        optionsSpace,
        options?.replace(TYPE_PATTERN, input => cliTpl`${{ input }}`),
        descriptionSpace,
        cliTpl`${{ description }}`
      ]
    )
      .replace(TITLE_PATTERN, title => cliTpl`${{ title }}`);
  }

  /**
   * Colorize usage
   */
  static colorizeUsage(usage: string): string {
    return namedReplace<UsageGroup>(usage, USAGE_PATTERN,
      ({ title, space, name, nameSpace, options }) => [
        cliTpl`${{ title }}`,
        space,
        cliTpl`${{ param: name }}`,
        nameSpace,
        options?.replace(TYPE_PATTERN, input => cliTpl`${{ input }}`),
      ]
    );
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
   * @param failure
   * @param extra
   */
  static showHelp(command: commander.Command, failure?: string, extra?: string): void {
    if (failure) {
      console!.error(cliTpl`${{ failure }}\n`);
    }
    console![failure ? 'error' : 'log'](
      HelpUtil.getHelpText(command.helpInformation(), extra)
    );
  }
}