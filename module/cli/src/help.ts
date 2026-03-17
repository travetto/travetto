import util from 'node:util';

import { castKey, getClass, JSONUtil, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex, ValidationResultError } from '@travetto/schema';

import { cliTpl } from './color.ts';
import { HELP_FLAG, type CliCommandShape } from './types.ts';
import { CliCommandRegistryIndex, UNKNOWN_COMMAND } from './registry/registry-index.ts';
import { CliSchemaExportUtil } from './schema-export.ts';

const validationSourceMap: Record<string, string> = { arg: 'Argument', flag: 'Flag' };

const ifDefined = <T>(value: T | null | '' | undefined): T | undefined =>
  (value === null || value === '' || value === undefined) ? undefined : value;

const MODULE_TO_COMMAND = {
  '@travetto/doc': ['doc'],
  '@travetto/email-compiler': ['email:compile', 'email:test', 'email:editor'],
  '@travetto/eslint': ['eslint', 'eslint:register', 'lint', 'lint:register'],
  '@travetto/model': ['model:install', 'model:export'],
  '@travetto/openapi': ['openapi:spec', 'openapi:client'],
  '@travetto/pack': ['pack', 'pack:zip', 'pack:docker'],
  '@travetto/repo': ['repo:publish', 'repo:version', 'repo:exec', 'repo:list'],
  '@travetto/test': ['test', 'test:watch', 'test:direct'],
  '@travetto/web-http': ['web:http'],
  '@travetto/web-rpc': ['web:rpc-client'],
};

const COMMAND_TO_MODULE = Object.fromEntries(Object.entries(MODULE_TO_COMMAND).flatMap(([k, v]) => v.map(sv => [sv, k])));

/**
 * Utilities for showing help
 */
export class HelpUtil {

  /** Render the unknown command message */
  static renderUnknownCommandMessage(command: string): string {
    const module = COMMAND_TO_MODULE[command];
    if (module) {
      return cliTpl`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: command }} please run:\n
${{ identifier: Runtime.getInstallCommand(module) }}
`;
    } else {
      return cliTpl`${{ subtitle: 'Unknown command' }}: ${{ input: command }}`;
    }
  }

  /**
   * Render command-specific help
   * @param command
   */
  static async renderCommandHelp(command: CliCommandShape): Promise<string> {
    const schema = SchemaRegistryIndex.getConfig(getClass(command));
    const { name: commandName } = CliCommandRegistryIndex.get(getClass(command));
    const args = schema.methods.main?.parameters ?? [];

    const params = [cliTpl`${{ param: HELP_FLAG }}`];
    const descriptions = ['display help for command'];
    const usage = [cliTpl`${{ title: 'Usage:' }} ${{ param: commandName }} ${{ input: '[options]' }}`,];

    // Ensure finalized
    for (const field of args) {
      const type = field.type === String && field.enum && field.enum?.values.length <= 7 ? field.enum?.values?.join('|') : field.type.name.toLowerCase();
      const arg = `${field.name}${field.array ? '...' : ''}:${type}`;
      usage.push(cliTpl`${{ input: field.required?.active !== false ? `<${arg}>` : `[${arg}]` }}`);
    }

    for (const field of Object.values(schema.fields)) {
      const key = castKey<CliCommandShape>(field.name);
      const defaultValue = ifDefined(command[key]) ?? ifDefined(field.default);
      const aliases = (field.aliases ?? [])
        .filter(flag => flag.startsWith('-'))
        .filter(flag =>
          (field.type !== Boolean) || (defaultValue !== true ? !flag.startsWith('--no-') : flag.startsWith('--'))
        );
      let type: string | undefined;

      if (field.type === String && field.enum && field.enum.values.length <= 3) {
        type = field.enum.values?.join('|');
      } else if (field.type !== Boolean) {
        ({ type } = CliSchemaExportUtil.baseInputType(field));
      }

      const parameter = [
        cliTpl`${{ param: aliases.join(', ') }}`,
        ...(type ? [cliTpl`${{ type: `<${type}>` }}`] : []),
      ];

      params.push(parameter.join(' '));
      const parts = [cliTpl`${{ title: field.description }}`];

      if (defaultValue !== undefined) {
        parts.push(cliTpl`(default: ${{ input: JSONUtil.toUTF8(defaultValue) }})`);
      }
      descriptions.push(parts.join(' '));
    }

    const paramWidths = params.map(item => util.stripVTControlCharacters(item).length);
    const descWidths = descriptions.map(item => util.stripVTControlCharacters(item).length);

    const paramWidth = Math.max(...paramWidths);
    const descWidth = Math.max(...descWidths);

    const extendedHelpText = await (command.help?.() ?? []);
    if (extendedHelpText.length && extendedHelpText.at(-1) !== '') {
      extendedHelpText.push('');
    }

    return [
      usage.join(' '),
      '',
      cliTpl`${{ title: 'Options:' }}`,
      ...params.map((_, i) =>
        `  ${params[i]}${' '.repeat((paramWidth - paramWidths[i]))}  ${descriptions[i].padEnd(descWidth)}${' '.repeat((descWidth - descWidths[i]))}`
      ),
      '',
      ...extendedHelpText
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
  static renderValidationError(validationError: ValidationResultError): string {
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

  /** Error handler */
  static async renderError(error: unknown, cmd: string, command?: CliCommandShape): Promise<void> {
    process.exitCode ??= 1;
    if (error instanceof ValidationResultError) {
      console.error!(this.renderValidationError(error));
    } else if (error instanceof Error) {
      console.error!(cliTpl`${{ failure: error.stack }}\n`);
    }
    if (command) {
      console.error!(await this.renderCommandHelp(command));
    } else if (error === UNKNOWN_COMMAND) {
      console.error!(this.renderUnknownCommandMessage(cmd));
    }
    console.error!();
  }
}