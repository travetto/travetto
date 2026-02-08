import fs from 'node:fs/promises';
import path from 'node:path';

import { Runtime } from '@travetto/runtime';
import type { SchemaClassConfig, SchemaFieldConfig, SchemaInputConfig } from '@travetto/schema';

import type { ParsedState } from './types.ts';

type ParsedInput = ParsedState['all'][number];

const RAW_SEPARATOR = '--';
const VALID_FLAG = /^-{1,2}[a-z]/i;
const HELP_FLAG = /^(-h|--help)$/;
const LONG_FLAG_WITH_EQ = /^--[a-z][^= ]+=\S+/i;
const CONFIG_PREFIX = '+=';
const SPACE = new Set([32, 7, 13, 10]);

export const ENV_PREFIX = 'env.';
export const isBoolFlag = (value?: SchemaInputConfig): boolean => value?.type === Boolean && !value.array;

export type AliasesParseResult = Record<'long' | 'short' | 'raw' | 'env', string[]>;

/**
 * Parsing support for the cli
 */
export class CliParseUtil {

  static toEnvField(key: string): string {
    return key.startsWith(ENV_PREFIX) ? key : `${ENV_PREFIX}${key}`;
  }

  static readToken(text: string, start = 0): { next: number, value?: string } {
    const collected: number[] = [];
    let i = start;
    let done = false;
    let quote: number | undefined;
    let escaped = false;
    outer: for (; i < text.length; i += 1) {
      const ch = text.charCodeAt(i);
      const space = SPACE.has(ch);
      if (escaped) {
        escaped = false;
        collected.push(ch);
      } else if (done && !space) {
        break outer;
      } else if (!quote && space) {
        done = true;
      } else {
        switch (ch) {
          case 92: /* Backslash */ escaped = true; break;
          case 39: /* Single quote */ case 34: /* Double quote */
            if (quote === ch) { // End quote
              quote = undefined;
            } else if (!quote) {
              quote = ch;
            } else {
              collected.push(ch);
            }
            break;
          default: collected.push(ch);
        }
      }
    }
    return { next: i, value: collected.length ? String.fromCharCode(...collected) : undefined };
  }

  /**
   * Get a user-specified module if present
   */
  static getSpecifiedModule(schema: SchemaClassConfig, args: string[]): string | undefined {
    const separatorIndex = args.includes(RAW_SEPARATOR) ? args.indexOf(RAW_SEPARATOR) : args.length;
    const input = Object.values(schema.fields).find(config => config.specifiers?.includes('module'));
    const envKey = input?.aliases?.filter(alias => alias.startsWith(ENV_PREFIX)).map(alias => alias.replace(ENV_PREFIX, ''))[0] ?? '';
    const flags = new Set(input?.aliases ?? []);
    const check = (key?: string, value?: string): string | undefined => flags.has(key!) ? value : undefined;
    return args.reduce(
      (name, value, i, values) =>
        (i < separatorIndex ? check(values[i - 1], value) ?? check(...value.split('=')) : undefined) ?? name,
      process.env[envKey]
    );
  }

  /**
   * Read configuration file given flag
   */
  static async readFlagFile(flag: string, module?: string): Promise<string[]> {
    const key = flag.replace(CONFIG_PREFIX, '');
    const overrides = { '@': module ?? Runtime.main.name };

    // We have a file
    const relativePath = (key.includes('/') ? key : `@#support/pack.${key}.flags`)
      .replace(/^(@[^#]*)#(.*)$/, (_, imp, rest) => `${Runtime.modulePath(imp, overrides)}/${rest}`);

    const file = path.resolve(relativePath);

    if (!await fs.stat(file).catch(() => false)) {
      throw new Error(`Missing flag file: ${key}, unable to proceed`);
    }

    const data = await fs.readFile(file, 'utf8');
    const args: string[] = [];
    let token: { next: number, value?: string } = { next: 0 };
    while (token.next < data.length) {
      token = this.readToken(data, token.next);
      if (token.value !== undefined) {
        args.push(token.value);
      }
    }
    return args;
  }

  /**
   * Parse args to extract command from argv along with other params.  Will skip
   * argv[0] and argv[1] if equal to process.argv[0:2]
   */
  static getArgs(argv: string[]): { cmd?: string, args: string[], help?: boolean } {
    let offset = 0;
    if (argv[0] === process.argv[0] && argv[1] === process.argv[1]) {
      offset = 2;
    }
    const out = argv.slice(offset);
    const max = out.includes(RAW_SEPARATOR) ? out.indexOf(RAW_SEPARATOR) : out.length;
    const valid = out.slice(0, max);
    const cmd = valid.length > 0 && !valid[0].startsWith('-') ? valid[0] : undefined;
    const helpIdx = valid.findIndex(flag => HELP_FLAG.test(flag));
    const args = out.slice(cmd ? 1 : 0);
    const result = { cmd, args, help: helpIdx >= 0 };
    return result;
  }

  /**
   * Expand flag arguments into full argument list
   */
  static async expandArgs(schema: SchemaClassConfig, args: string[]): Promise<string[]> {
    const separatorIndex = args.includes(RAW_SEPARATOR) ? args.indexOf(RAW_SEPARATOR) : args.length;
    const module = this.getSpecifiedModule(schema, args);
    return Promise
      .all(args.map(async (arg, i) =>
        await (arg.startsWith(CONFIG_PREFIX) && (i < separatorIndex || separatorIndex < 0) ? this.readFlagFile(arg, module) : arg))
      )
      .then(expanded => expanded.flat());
  }

  /**
   * Parse inputs to command
   */
  static async parse(schema: SchemaClassConfig, inputs: string[]): Promise<ParsedState> {
    const flagMap = new Map<string, SchemaFieldConfig>(
      Object.values(schema.fields).flatMap(field => (field.aliases ?? []).map(name => [name, field]))
    );

    const out: ParsedInput[] = [];

    // Load env vars to front
    for (const field of Object.values(schema.fields)) {
      for (const envName of (field.aliases ?? []).filter(alias => alias.startsWith(ENV_PREFIX))) {
        const simple = envName.replace(ENV_PREFIX, '');
        if (simple in process.env) {
          const value: string = process.env[simple]!;
          if (field.array) {
            out.push(...value.split(/\s*,\s*/g).map(item => ({ type: 'flag', fieldName: field.name, input: envName, value: item }) as const));
          } else {
            out.push({ type: 'flag', fieldName: field.name, input: envName, value });
          }
        }
      }
    }

    let argIdx = 0;

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];

      if (input === RAW_SEPARATOR) { // Raw separator
        out.push(...inputs.slice(i + 1).map((arg, idx) => ({ type: 'unknown', input: arg, index: argIdx + idx }) as const));
        break;
      } else if (LONG_FLAG_WITH_EQ.test(input)) {
        const [key, ...values] = input.split('=');
        const field = flagMap.get(key);
        if (field) {
          out.push({ type: 'flag', fieldName: field.name, input: key, value: values.join('=') });
        } else {
          out.push({ type: 'unknown', input });
        }
      } else if (VALID_FLAG.test(input)) { // Flag
        const field = flagMap.get(input);
        if (!field) {
          out.push({ type: 'unknown', input });
        } else {
          const next = inputs[i + 1];
          const base = { type: 'flag', fieldName: field.name, input, array: field.array } as const;
          if ((next && (VALID_FLAG.test(next) || next === RAW_SEPARATOR)) || isBoolFlag(field)) {
            if (isBoolFlag(field)) {
              out.push({ ...base, value: !input.startsWith('--no-') });
            } else {
              out.push(base);
            }
          } else {
            out.push({ ...base, value: next });
            i += 1;
          }
        }
      } else {
        const field = schema.methods.main?.parameters[argIdx];
        out.push({ type: 'arg', array: field?.array ?? false, input, index: argIdx });
        // Move argIdx along if not in a var arg situation
        if (!field?.array) {
          argIdx += 1;
        }
      }
    }

    // Store for later, if needed
    return {
      inputs,
      all: out,
      unknown: out.filter(input => input.type === 'unknown').map(input => input.input),
      flags: out.filter(input => input.type === 'flag')
    };
  }

  /**
   * Parse aliases into categories for registration
   */
  static parseAliases(aliases: string[]): AliasesParseResult {
    return aliases.reduce<AliasesParseResult>((result, alias) => {
      if (VALID_FLAG.test(alias)) {
        if (alias.startsWith('--')) {
          result.long.push(alias);
        } else {
          result.short.push(alias);
        }
      } else if (alias.startsWith(ENV_PREFIX)) {
        result.env.push(alias);
      } else {
        result.raw.push(alias);
      }
      return result;
    }, { long: [], short: [], raw: [], env: [] });
  }
}