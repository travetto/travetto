import { SchemaClassConfig, SchemaInputConfig } from '@travetto/schema';

import { CliCommandConfig, CliCommandInput } from '../types.ts';

const LONG_FLAG = /^--[a-z][^= ]+/i;
const SHORT_FLAG = /^-[a-z]/i;

const isBoolFlag = (x?: CliCommandInput): boolean => x?.type === 'boolean' && !x.array;

/**
 * Utilities for building command registry entries
 */
export class CliCommandRegistryUtil {

  /**
   * Get the base type for a CLI command input
   */
  static baseType(x: SchemaInputConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
    switch (x.type) {
      case Date: return { type: 'date' };
      case Boolean: return { type: 'boolean' };
      case Number: return { type: 'number' };
      case RegExp: return { type: 'regex' };
      case String: {
        switch (true) {
          case x.specifiers?.includes('module'): return { type: 'module' };
          case x.specifiers?.includes('file'): return {
            type: 'file',
            fileExtensions: x.specifiers?.map(s => s.split('ext:')[1]).filter(s => !!s)
          };
        }
      }
    }
    return { type: 'string' };
  }

  /**
   * Process input configuration for CLI commands
   */
  static processInput(x: SchemaInputConfig): CliCommandInput {
    return {
      ...CliCommandRegistryUtil.baseType(x),
      ...(('name' in x && typeof x.name === 'string') ? { name: x.name } : { name: '' }),
      description: x.description,
      array: x.array,
      required: x.required?.active,
      choices: x.enum?.values,
      default: Array.isArray(x.default) ? x.default.slice(0) : x.default,
      flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
      envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
    };
  }

  /**
   * Build command schema
   */
  static buildSchema(cfg: SchemaClassConfig): Pick<CliCommandConfig, 'args' | 'flags'> {
    const flags = Object.values(cfg.fields).map(CliCommandRegistryUtil.processInput);

    // Add help command
    flags.push({ name: 'help', flagNames: ['h'], description: 'display help for command', type: 'boolean' });

    const method = cfg.methods.main.parameters.map(CliCommandRegistryUtil.processInput);

    const used = new Set(flags
      .flatMap(f => f.flagNames ?? [])
      .filter(x => SHORT_FLAG.test(x) || x.replaceAll('-', '').length < 3)
      .map(x => x.replace(/^-+/, ''))
    );

    for (const flag of flags) {
      let short = (flag.flagNames ?? []).find(x => SHORT_FLAG.test(x) || x.replaceAll('-', '').length < 3)?.replace(/^-+/, '');
      const long = (flag.flagNames ?? []).find(x => LONG_FLAG.test(x) || x.replaceAll('-', '').length > 2)?.replace(/^-+/, '') ??
        flag.name.replace(/([a-z])([A-Z])/g, (_, l, r: string) => `${l}-${r.toLowerCase()}`);
      const aliases: string[] = flag.flagNames = [];

      if (short === undefined) {
        if (!(isBoolFlag(flag) && flag.default === true)) {
          short = flag.name.charAt(0);
          if (!used.has(short)) {
            aliases.push(`-${short}`);
            used.add(short);
          }
        }
      } else {
        aliases.push(`-${short}`);
      }

      aliases.push(`--${long}`);

      if (isBoolFlag(flag)) {
        aliases.push(`--no-${long}`);
      }
    }

    return { args: method, flags };
  }
}