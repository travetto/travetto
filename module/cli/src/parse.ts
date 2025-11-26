import fs from 'node:fs/promises';
import path from 'node:path';

import { Runtime } from '@travetto/runtime';
import { SchemaClassConfig, SchemaFieldConfig, SchemaInputConfig } from '@travetto/schema';

import { ParsedState } from './types.ts';

type ParsedInput = ParsedState['all'][number];

const RAW_SEP = '--';
const VALID_FLAG = /^-{1,2}[a-z]/i;
const HELP_FLAG = /^-h|--help$/;
const LONG_FLAG_WITH_EQ = /^--[a-z][^= ]+=\S+/i;
const CONFIG_PRE = '+=';
const ENV_PRE = 'env.';
const SPACE = new Set([32, 7, 13, 10]);

export const isBoolFlag = (x?: SchemaInputConfig): boolean => x?.type === Boolean && !x.array;

/**
 * Parsing support for the cli
 */
export class CliParseUtil {

  static toEnvField(k: string): string {
    return `${ENV_PRE}${k}`;
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
    const SEP = args.includes(RAW_SEP) ? args.indexOf(RAW_SEP) : args.length;
    const input = Object.values(schema.fields).find(x => x.specifiers?.includes('module'));
    const ENV_KEY = input?.aliases?.filter(x => x.startsWith(ENV_PRE)).map(x => x.replace(ENV_PRE, ''))[0] ?? '';
    const flags = new Set(input?.aliases ?? []);
    const check = (k?: string, v?: string): string | undefined => flags.has(k!) ? v : undefined;
    return args.reduce(
      (m, x, i, arr) =>
        (i < SEP ? check(arr[i - 1], x) ?? check(...x.split('=')) : undefined) ?? m,
      process.env[ENV_KEY]
    );
  }

  /**
   * Read configuration file given flag
   */
  static async readFlagFile(flag: string, mod?: string): Promise<string[]> {
    const key = flag.replace(CONFIG_PRE, '');
    const overrides = { '@': mod ?? Runtime.main.name };

    // We have a file
    const rel = (key.includes('/') ? key : `@#support/pack.${key}.flags`)
      .replace(/^(@[^#]*)#(.*)$/, (_, imp, rest) => `${Runtime.modulePath(imp, overrides)}/${rest}`);

    const file = path.resolve(rel);

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
    const max = out.includes(RAW_SEP) ? out.indexOf(RAW_SEP) : out.length;
    const valid = out.slice(0, max);
    const cmd = valid.length > 0 && !valid[0].startsWith('-') ? valid[0] : undefined;
    const helpIdx = valid.findIndex(x => HELP_FLAG.test(x));
    const args = out.slice(cmd ? 1 : 0);
    const res = { cmd, args, help: helpIdx >= 0 };
    return res;
  }

  /**
   * Expand flag arguments into full argument list
   */
  static async expandArgs(schema: SchemaClassConfig, args: string[]): Promise<string[]> {
    const SEP = args.includes(RAW_SEP) ? args.indexOf(RAW_SEP) : args.length;
    const mod = this.getSpecifiedModule(schema, args);
    return (await Promise.all(args.map((x, i) =>
      x.startsWith(CONFIG_PRE) && (i < SEP || SEP < 0) ? this.readFlagFile(x, mod) : x))).flat();
  }

  /**
   * Parse inputs to command
   */
  static async parse(schema: SchemaClassConfig, inputs: string[]): Promise<ParsedState> {
    const flagMap = new Map<string, SchemaFieldConfig>(
      Object.values(schema.fields).flatMap(f => (f.aliases ?? []).map(name => [name, f]))
    );

    const out: ParsedInput[] = [];

    // Load env vars to front
    for (const field of Object.values(schema.fields)) {
      for (const envName of (field.aliases ?? []).filter(x => x.startsWith(ENV_PRE))) {
        const simple = envName.replace(ENV_PRE, '');
        if (simple in process.env) {
          const value: string = process.env[simple]!;
          if (field.array) {
            out.push(...value.split(/\s*,\s*/g).map(v => ({ type: 'flag', fieldName: field.name.toString(), input: envName, value: v }) as const));
          } else {
            out.push({ type: 'flag', fieldName: field.name.toString(), input: envName, value });
          }
        }
      }
    }

    let argIdx = 0;

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];

      if (input === RAW_SEP) { // Raw separator
        out.push(...inputs.slice(i + 1).map((x, idx) => ({ type: 'unknown', input: x, index: argIdx + idx }) as const));
        break;
      } else if (LONG_FLAG_WITH_EQ.test(input)) {
        const [k, ...v] = input.split('=');
        const field = flagMap.get(k);
        if (field) {
          out.push({ type: 'flag', fieldName: field.name.toString(), input: k, value: v.join('=') });
        } else {
          out.push({ type: 'unknown', input });
        }
      } else if (VALID_FLAG.test(input)) { // Flag
        const field = flagMap.get(input);
        if (!field) {
          out.push({ type: 'unknown', input });
        } else {
          const next = inputs[i + 1];
          const base = { type: 'flag', fieldName: field.name.toString(), input, array: field.array } as const;
          if ((next && (VALID_FLAG.test(next) || next === RAW_SEP)) || isBoolFlag(field)) {
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
      unknown: out.filter(x => x.type === 'unknown').map(x => x.input),
      flags: out.filter(x => x.type === 'flag')
    };
  }
}