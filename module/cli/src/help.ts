import util from 'node:util';

import { castKey, getClass, JSONUtil } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { cliTpl } from './color.ts';
import type { CliCommandShape } from './types.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import type { CliValidationResultError } from './error.ts';
import { CliSchemaExportUtil } from './schema-export.ts';

const validationSourceMap: Record<string, string> = {
  arg: 'Argument',
  flag: 'Flag'
};

const ifDefined = <T>(value: T | null | '' | undefined): T | undefined =>
  (value === null || value === '' || value === undefined) ? undefined : value;

/**
 * Utilities for showing help
 */
export class HelpUtil {

  /**
   * Render command-specific help
   * @param command
   */
  static async renderCommandHelp(command: CliCommandShape): Promise<string> {
    const schema = SchemaRegistryIndex.getConfig(getClass(command));
    const { name: commandName } = CliCommandRegistryIndex.get(getClass(command));
    const args = schema.methods.main?.parameters ?? [];

    await command.preHelp?.();

    // Ensure finalized

    const usage: string[] = [cliTpl`${{ title: 'Usage:' }} ${{ param: commandName }} ${{ input: '[options]' }}`,];
    for (const field of args) {
      const type = field.type === String && field.enum && field.enum?.values.length <= 7 ? field.enum?.values?.join('|') : field.type.name.toLowerCase();
      const arg = `${field.name}${field.array ? '...' : ''}:${type}`;
      usage.push(cliTpl`${{ input: field.required?.active !== false ? `<${arg}>` : `[${arg}]` }}`);
    }

    const params: string[] = [];
    const descriptions: string[] = [];

    for (const field of Object.values(schema.fields)) {
      const key = castKey<CliCommandShape>(field.name);
      const defaultValue = ifDefined(command[key]) ?? ifDefined(field.default);
      const aliases = (field.aliases ?? [])
        .filter(flag => flag.startsWith('-'))
        .filter(flag =>
          (field.type !== Boolean) || ((defaultValue !== true || field.name === 'help') ? !flag.startsWith('--no-') : flag.startsWith('--'))
        );
      let type: string | undefined;

      if (field.type === String && field.enum && field.enum.values.length <= 3) {
        type = field.enum.values?.join('|');
      } else if (field.type !== Boolean) {
        ({ type } = CliSchemaExportUtil.baseInputType(field));
      }

      const param = [
        cliTpl`${{ param: aliases.join(', ') }}`,
        ...(type ? [cliTpl`${{ type: `<${type}>` }}`] : []),
      ];

      params.push(param.join(' '));
      const desc = [cliTpl`${{ title: field.description }}`];

      if (key !== 'help' && defaultValue !== undefined) {
        desc.push(cliTpl`(default: ${{ input: JSONUtil.toUTF8(defaultValue) }})`);
      }
      descriptions.push(desc.join(' '));
    }

    const paramWidths = params.map(item => util.stripVTControlCharacters(item).length);
    const descWidths = descriptions.map(item => util.stripVTControlCharacters(item).length);

    const paramWidth = Math.max(...paramWidths);
    const descWidth = Math.max(...descWidths);

    const helpText = await (command.help?.() ?? []);
    if (helpText.length && helpText.at(-1) !== '') {
      helpText.push('');
    }

    return [
      usage.join(' '),
      '',
      cliTpl`${{ title: 'Options:' }}`,
      ...params.map((_, i) =>
        `  ${params[i]}${' '.repeat((paramWidth - paramWidths[i]))}  ${descriptions[i].padEnd(descWidth)}${' '.repeat((descWidth - descWidths[i]))}`
      ),
      '',
      ...helpText
    ].map(line => line.trimEnd()).join('\n');
  }

  /**
   * Render help listing of all commands
   */
  static async renderAllHelp(title?: string): Promise<string> {
    const rows: string[] = [];

    // All
    const resolved = await CliCommandRegistryIndex.load();
    const maxWidth = resolved.reduce((a, b) => Math.max(a, util.stripVTControlCharacters(b.command).length), 0);

    for (const { command: cmd, schema } of resolved) {
      try {
        if (schema && !schema.private) {
          rows.push(cliTpl`  ${{ param: cmd.padEnd(maxWidth, ' ') }} ${{ title: schema.description || '' }}`);
        }
      } catch (error) {
        if (error instanceof Error) {
          rows.push(cliTpl`  ${{ param: cmd.padEnd(maxWidth, ' ') }} ${{ failure: error.message.split(/\n/)[0] }}`);
        } else {
          throw error;
        }
      }
    }

    const lines = [cliTpl`${{ title: 'Commands:' }}`, ...rows, ''];

    lines.unshift(title ? cliTpl`${{ title }}` : cliTpl`${{ title: 'Usage:' }}  ${{ param: '[options]' }} ${{ param: '[command]' }}`, '');

    return lines.map(line => line.trimEnd()).join('\n');
  }

  /**
   * Render validation error to a string
   */
  static renderValidationError(validationError: CliValidationResultError): string {
    return [
      cliTpl`${{ failure: 'Execution failed' }}:`,
      ...validationError.details.errors.map(error => {
        if (error.source && error.source in validationSourceMap) {
          return cliTpl` * ${{ identifier: validationSourceMap[error.source] }} ${{ subtitle: error.message }}`;
        }
        return cliTpl` * ${{ failure: error.message }}`;
      }),
      '',
    ].join('\n');
  }
}