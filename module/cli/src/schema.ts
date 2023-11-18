import { Class, ConsoleManager, GlobalEnv } from '@travetto/base';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { CliCommandRegistry } from './registry';
import { CliCommandInput, CliCommandSchema, CliCommandShape } from './types';
import { CliValidationResultError } from './error';

const VALID_FLAG = /^-{1,2}[a-z]/i;
const LONG_FLAG = /^--[a-z][^= ]+/i;
const LONG_FLAG_WITH_EQ = /^--[a-z][^= ]+=\S+/i;
const SHORT_FLAG = /^-[a-z]/i;

type ParsedInput =
  { type: 'unknown', input: string } |
  { type: 'arg', input: string, array?: boolean, index: number } |
  { type: 'flag', input: string, array?: boolean, fieldName: string, value?: unknown };

const isBoolFlag = (x?: CliCommandInput): boolean => x?.type === 'boolean' && !x.array;

const getInput = (cfg: { field?: CliCommandInput, rawText?: string, input: string, index?: number, value?: string }): ParsedInput => {
  const { field, input, rawText = input, value, index } = cfg;
  if (!field) {
    return { type: 'unknown', input: rawText };
  } else if (!field.flagNames?.length) {
    return { type: 'arg', input: field ? input : rawText ?? input, array: field.array, index: index! };
  } else {
    return {
      type: 'flag',
      fieldName: field.name,
      array: field.array,
      input: field ? input : rawText ?? input,
      value: value ?? (isBoolFlag(field) ? !input.startsWith('--no-') : undefined)
    };
  }
};

function fieldToInput(x: FieldConfig): CliCommandInput {
  const type = x.type === Date ? 'date' :
    x.type === Boolean ? 'boolean' :
      x.type === String ? (x.specifiers?.includes('file') ? 'file' : 'string') :
        x.type === Number ? 'number' :
          x.type === RegExp ? 'regex' : 'string';
  return ({
    name: x.name,
    description: x.description,
    array: x.array,
    required: x.required?.active,
    choices: x.enum?.values,
    fileExtensions: type === 'file' ? x.specifiers?.filter(s => s.startsWith('ext:')).map(s => s.split('ext:')[1]) : undefined,
    type,
    default: x.default,
    flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
    envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
  });
}

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
   * Parse inputs to command
   */
  static async parse<T extends CliCommandShape>(cls: Class<T>, inputs: string[]): Promise<ParsedInput[]> {
    const schema = await this.getSchema(cls);
    const flagMap = new Map<string, CliCommandInput>(
      schema.flags.flatMap(f => (f.flagNames ?? []).map(name => [name, f]))
    );

    const out: ParsedInput[] = [];

    // Load env vars to front
    for (const field of schema.flags) {
      for (const envName of field.envVars ?? []) {
        if (envName in process.env) {
          const value: string = process.env[envName]!;
          if (field.array) {
            out.push(...value.split(/\s*,\s*/g).map(v => getInput({ field, input: `env.${envName}`, value: v })));
          } else {
            out.push(getInput({ field, input: `env.${envName}`, value }));
          }
        }
      }
    }

    let argIdx = 0;

    for (let i = 0; i < inputs.length; i += 1) {
      const input = inputs[i];

      if (input === '--') { // Raw separator
        out.push(...inputs.slice(i + 1).map(x => getInput({ input: x })));
        break;
      } else if (LONG_FLAG_WITH_EQ.test(input)) {
        const [k, ...v] = input.split('=');
        const field = flagMap.get(k);
        out.push(getInput({ field, rawText: input, input: k, value: v.join('=') }));
      } else if (VALID_FLAG.test(input)) { // Flag
        const field = flagMap.get(input);
        const next = inputs[i + 1];
        if ((next && (VALID_FLAG.test(next) || next === '--')) || isBoolFlag(field)) {
          out.push(getInput({ field, input }));
        } else {
          out.push(getInput({ field, input, value: next }));
          i += 1;
        }
      } else {
        const field = schema.args[argIdx];
        out.push(getInput({ field, input, index: argIdx }));
        // Move argIdx along if not in a vararg situation
        if (!field?.array) {
          argIdx += 1;
        }
      }
    }

    return out;
  }

  /**
   * Bind arguments to command
   */
  static async bindFlags<T extends CliCommandShape>(cmd: T, args: ParsedInput[]): Promise<void> {
    const template: Partial<T> = {};

    for (const arg of args) {
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
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;
    BindUtil.bindSchemaToObject(cls, cmd, template);
  }

  /**
   * Produce the arguments into the final argument set
   */
  static async bindArgs(cmd: CliCommandShape, inputs: ParsedInput[]): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;
    const bound: unknown[] = [];
    for (const input of inputs) {
      if (input.type === 'arg') {
        if (input.array) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          ((bound[input.index] ??= []) as unknown[]).push(input.input);
        } else {
          bound[input.index] = input.input;
        }
      }
    }
    return BindUtil.coerceMethodParams(cls, 'main', bound, true);
  }

  /**
   * Get the unused arguments
   */
  static getUnusedArgs(args: ParsedInput[]): string[] {
    return args.filter(x => x.type === 'unknown').map(x => x.input);
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

  /**
   * Bind and validate a command with a given set of arguments
   */
  static async bindAndValidateArgs(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class;
    await cmd.initialize?.();
    const parsed = await this.parse(cls, args);
    await this.bindFlags(cmd, parsed);
    const known = await this.bindArgs(cmd, parsed);
    await cmd.finalize?.(this.getUnusedArgs(parsed));
    await this.validate(cmd, known);
    return known;
  }
}