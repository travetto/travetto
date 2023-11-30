import { Class, ConsoleManager, GlobalEnv } from '@travetto/base';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { CliCommandRegistry } from './registry';
import { ParsedState, CliCommandInput, CliCommandSchema, CliCommandShape } from './types';
import { CliValidationResultError } from './error';

const LONG_FLAG = /^--[a-z][^= ]+/i;
const SHORT_FLAG = /^-[a-z]/i;

const isBoolFlag = (x?: CliCommandInput): boolean => x?.type === 'boolean' && !x.array;

function baseType(x: FieldConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
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

const fieldToInput = (x: FieldConfig): CliCommandInput => ({
  ...baseType(x),
  name: x.name,
  description: x.description,
  array: x.array,
  required: x.required?.active,
  choices: x.enum?.values,
  default: Array.isArray(x.default) ? x.default.slice(0) : x.default,
  flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
  envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
});

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {

  static #schemas = new Map<Class, CliCommandSchema>();

  /**
   * Get schema for a given command
   */
  static async getSchema(src: Class | CliCommandShape): Promise<CliCommandSchema> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = 'main' in src ? src.constructor as Class : src;
    if (this.#schemas.has(cls)) {
      return this.#schemas.get(cls)!;
    }

    // Ensure finalized
    try {
      ConsoleManager.setDebug(false);
      const parent = SchemaRegistry.getParentClass(cls);
      if (parent?.Ⲑid) {
        SchemaRegistry.onInstall(parent, { type: 'added', curr: parent });
      }
      SchemaRegistry.onInstall(cls, { type: 'added', curr: cls });
    } finally {
      ConsoleManager.setDebug(GlobalEnv.debug, GlobalEnv.devMode);
    }

    const schema = await SchemaRegistry.getViewSchema(cls);
    const flags = Object.values(schema.schema).map(fieldToInput);

    // Add help command
    flags.push({ name: 'help', flagNames: ['h'], description: 'display help for command', type: 'boolean' });

    const method = SchemaRegistry.getMethodSchema(cls, 'main').map(fieldToInput);

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

    const fullSchema = SchemaRegistry.get(cls);
    const { cls: _cls, preMain: _preMain, ...meta } = CliCommandRegistry.getByClass(cls)!;
    const cfg: CliCommandSchema = {
      ...meta,
      args: method,
      flags,
      title: fullSchema.title ?? cls.name,
      description: fullSchema.description ?? ''
    };
    this.#schemas.set(cls, cfg);
    return cfg;
  }

  /**
   * Bind parsed inputs to command
   */
  static async bindInput<T extends CliCommandShape>(cmd: T, state: ParsedState): Promise<unknown[]> {
    const template: Partial<T> = {};
    const bound: unknown[] = [];

    for (const arg of state.all) {
      switch (arg.type) {
        case 'flag': {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const key = arg.fieldName as keyof T;
          const value = arg.value!;
          if (arg.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ((template[key] as unknown[]) ??= []).push(value);
          } else {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            template[key] = value as unknown as T[typeof key];
          }
          break;
        }
        case 'arg': {
          if (arg.array) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ((bound[arg.index] ??= []) as unknown[]).push(arg.input);
          } else {
            bound[arg.index] = arg.input;
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;
    BindUtil.bindSchemaToObject(cls, cmd, template);
    return BindUtil.coerceMethodParams(cls, 'main', bound);
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(cmd: CliCommandShape, args: unknown[]): Promise<typeof cmd> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;

    const paramNames = SchemaRegistry.getMethodSchema(cls, 'main').map(x => x.name);

    const validators = [
      (): Promise<void> => SchemaValidator.validate(cls, cmd).then(() => { }),
      (): Promise<void> => SchemaValidator.validateMethod(cls, 'main', args, paramNames),
      async (): Promise<void> => {
        const res = await cmd.validate?.(...args);
        if (res) {
          throw new CliValidationResultError(Array.isArray(res) ? res : [res]);
        }
      },
    ];

    const SOURCES = ['flag', 'arg', 'custom'] as const;

    const results = validators.map((x, i) => x().catch(err => {
      if (!(err instanceof CliValidationResultError) && !(err instanceof ValidationResultError)) {
        throw err;
      }
      return err.errors.map(v => ({ source: SOURCES[i], ...v }));
    }));

    const errors = (await Promise.all(results)).flatMap(x => (x ?? []));
    if (errors.length) {
      throw new CliValidationResultError(errors);
    }
    return cmd;
  }
}