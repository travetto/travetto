import util from 'node:util';

import { castKey, castTo, Primitive } from '@travetto/runtime';

import { cliTpl } from './color.ts';
import { CliCommandShape } from './types.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import { CliValidationResultError } from './error.ts';
import { isBoolFlag } from './parse.ts';

const validationSourceMap: Record<string, string> = {
  arg: 'Argument',
  flag: 'Flag'
};

/**
 * Utilities for showing help
 */
export class HelpUtil {

  /**
   * Render command-specific help
   * @param command
   */
  static async renderCommandHelp(command: CliCommandShape): Promise<string> {
    const { flags, args, name: commandName, title } = await CliCommandRegistryIndex.get(command);

    await command.preHelp?.();

    // Ensure finalized

    const usage: string[] = [cliTpl`${{ title: 'Usage:' }} ${{ param: commandName }} ${{ input: '[options]' }}`,];
    for (const field of args) {
      const type = field.type === 'string' && field.choices && field.choices.length <= 7 ? field.choices?.join('|') : field.type;
      const arg = `${field.name}${field.array ? '...' : ''}:${type}`;
      usage.push(cliTpl`${{ input: field.required ? `<${arg}>` : `[${arg}]` }}`);
    }

    const params: string[] = [];
    const descriptions: string[] = [];

    for (const flag of flags) {
      const key = castKey<CliCommandShape>(flag.name);
      const flagVal: Primitive = castTo(command[key]);

      let aliases = flag.flagNames ?? [];
      if (isBoolFlag(flag)) {
        if (flagVal === true) {
          aliases = (flag.flagNames ?? []).filter(x => !/^[-][^-]/.test(x));
        } else {
          aliases = (flag.flagNames ?? []).filter(x => !x.startsWith('--no-'));
        }
      }
      const param = [cliTpl`${{ param: aliases.join(', ') }}`];
      if (!isBoolFlag(flag)) {
        const type = flag.type === 'string' && flag.choices && flag.choices.length <= 3 ? flag.choices?.join('|') : flag.type;
        param.push(cliTpl`${{ type: `<${type}>` }}`);
      }
      params.push(param.join(' '));
      const desc = [cliTpl`${{ title: flag.description }}`];

      if (key !== 'help' && flagVal !== null && flagVal !== undefined && flagVal !== '') {
        desc.push(cliTpl`(default: ${{ input: JSON.stringify(flagVal) }})`);
      }
      descriptions.push(desc.join(' '));
    }

    const paramWidths = params.map(x => util.stripVTControlCharacters(x).length);
    const descWidths = descriptions.map(x => util.stripVTControlCharacters(x).length);

    const paramWidth = Math.max(...paramWidths);
    const descWidth = Math.max(...descWidths);

    const helpText = await (command.help?.() ?? []);
    if (helpText.length && helpText.at(-1) !== '') {
      helpText.push('');
    }

    return [
      ...(title ? [cliTpl`${{ title: commandName }}: ${{ subtitle: title }}`, ''] : []),
      usage.join(' '),
      '',
      cliTpl`${{ title: 'Options:' }}`,
      ...params.map((_, i) =>
        `  ${params[i]}${' '.repeat((paramWidth - paramWidths[i]))}  ${descriptions[i].padEnd(descWidth)}${' '.repeat((descWidth - descWidths[i]))}`
      ),
      '',
      ...helpText
    ].map(x => x.trimEnd()).join('\n');
  }

  /**
   * Render help listing of all commands
   */
  static async renderAllHelp(title?: string): Promise<string> {
    const rows: string[] = [];

    // All
    const resolved = await CliCommandRegistryIndex.load();
    const maxWidth = resolved.reduce((a, b) => Math.max(a, util.stripVTControlCharacters(b.command).length), 0);

    for (const { command: cmd, config: cfg } of resolved) {
      try {
        if (cfg && !cfg.hidden) {
          rows.push(cliTpl`  ${{ param: cmd.padEnd(maxWidth, ' ') }} ${{ title: cfg.title }}`);
        }
      } catch (err) {
        if (err instanceof Error) {
          rows.push(cliTpl`  ${{ param: cmd.padEnd(maxWidth, ' ') }} ${{ failure: err.message.split(/\n/)[0] }}`);
        } else {
          throw err;
        }
      }
    }

    const lines = [cliTpl`${{ title: 'Commands:' }}`, ...rows, ''];

    if (title === undefined || title) {
      lines.unshift(title ? cliTpl`${{ title }}` : cliTpl`${{ title: 'Usage:' }}  ${{ param: '[options]' }} ${{ param: '[command]' }}`, '');
    }
    return lines.map(x => x.trimEnd()).join('\n');
  }

  /**
   * Render validation error to a string
   */
  static renderValidationError(err: CliValidationResultError): string {
    return [
      cliTpl`${{ failure: 'Execution failed' }}:`,
      ...err.details.errors.map(e => {
        if (e.source && e.source in validationSourceMap) {
          return cliTpl` * ${{ identifier: validationSourceMap[e.source] }} ${{ subtitle: e.message }}`;
        }
        return cliTpl` * ${{ failure: e.message }}`;
      }),
      '',
    ].join('\n');
  }
}