import { Primitive } from '@travetto/base';
import { ValidationResultError } from '@travetto/schema';
import { stripAnsiCodes } from '@travetto/terminal';

import { cliTpl } from './color';
import { CliCommandShape } from './types';
import { CliCommandRegistry } from './registry';
import { CliCommandSchemaUtil } from './schema';

/**
 * Utilities for showing help
 */
export class HelpUtil {

  /**
   * Render command-specific help
   * @param command
   */
  static async #renderCommandHelp(command: CliCommandShape): Promise<string> {
    const commandName = CliCommandRegistry.getName(command);

    command.initializeFlags?.();

    // Ensure finalized
    const { flags, args } = await CliCommandSchemaUtil.getSchema(command);

    const usage: string[] = [cliTpl`${{ title: 'Usage:' }} ${{ param: commandName }} ${{ input: '[options]' }}`];
    for (const field of args) {
      const name = `${field.name}${field.array ? '...' : ''}`;
      usage.push(cliTpl`${{ input: field.required ? `<${name}>` : `[${name}]` }}`);
    }

    const params: string[] = [];
    const descs: string[] = [];

    for (const flag of flags) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const key = flag.name as keyof CliCommandShape;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const flagVal = command[key] as unknown as Exclude<Primitive, Error>;

      let aliases = flag.flagNames ?? [];
      if (flag.type === 'boolean' && !flag.array) {
        if (flagVal === true) {
          aliases = (flag.flagNames ?? []).filter(x => !/^[-][^-]/.test(x));
        } else {
          aliases = (flag.flagNames ?? []).filter(x => !x.startsWith('--no-'));
        }
      }
      const param = [cliTpl`${{ param: aliases.join(', ') }}`];
      if (!(flag.type === 'boolean' && !flag.array)) {
        param.push(cliTpl`${{ type: `<${flag.name}>` }}`);
      }
      params.push(param.join(' '));
      const desc = [cliTpl`${{ title: flag.description }}`];

      if (key !== 'help' && flagVal !== null && flagVal !== undefined) {
        desc.push(cliTpl`(default: ${{ input: flagVal }})`);
      }
      descs.push(desc.join(' '));
    }

    const paramWidths = params.map(x => stripAnsiCodes(x).length);
    const descWidths = descs.map(x => stripAnsiCodes(x).length);

    const paramWidth = Math.max(...paramWidths);
    const descWidth = Math.max(...descWidths);

    const helpText = await (command.help?.() ?? '');

    return [
      usage.join(' '),
      '',
      cliTpl`${{ title: 'Options:' }}`,
      ...params.map((_, i) =>
        `  ${params[i]}${' '.repeat((paramWidth - paramWidths[i]))}  ${descs[i].padEnd(descWidth)}${' '.repeat((descWidth - descWidths[i]))}`
      ),
      '',
      ...(helpText ? [helpText] : [])
    ].join('\n');
  }

  /**
   * Render help listing of all commands
   */
  static async #renderAllHelp(): Promise<string> {
    const rows: string[] = [];
    const keys = [...CliCommandRegistry.getCommandMapping().keys()].sort((a, b) => a.localeCompare(b));
    const maxWidth = keys.reduce((a, b) => Math.max(a, stripAnsiCodes(b).length), 0);

    for (const cmd of keys) {
      const inst = await CliCommandRegistry.getInstance(cmd);
      if (inst) {
        const schema = await CliCommandSchemaUtil.getSchema(inst);
        rows.push(cliTpl`  ${{ param: cmd.padEnd(maxWidth, ' ') }} ${{ title: schema.title }}`);
      }
    }
    return [
      cliTpl`${{ title: 'Usage:' }}  ${{ param: '[options]' }} ${{ param: '[command]' }}`,
      '',
      cliTpl`${{ title: 'Commands:' }}`,
      ...rows,
      ''
    ].join('\n');
  }

  /**
   * Render help
   */
  static async renderHelp(command?: CliCommandShape): Promise<string> {
    return command ? this.#renderCommandHelp(command) : this.#renderAllHelp();
  }

  /**
   * Render validation error to a string
   */
  static renderValidationError(cmd: CliCommandShape, err: ValidationResultError): string {
    console.error!(err);
    return '';
  }
}