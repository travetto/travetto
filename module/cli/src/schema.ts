import { Class, ConsoleManager, GlobalEnv } from '@travetto/base';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { CliCommandRegistry } from './registry';
import { CliCommandInput, CliCommandSchema, CliCommandShape } from './types';
import { CliValidationResultError } from './error';

function split(args: string[]): [core: string[], extra: string[]] {
  const restIdx = args.indexOf('--');
  if (restIdx >= 0) {
    return [args.slice(0, restIdx), args.slice(restIdx + 1)];
  } else {
    return [args, []];
  }
}

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

const VALID_FLAG = /^-{1,2}[a-z]/i;
const LONG_FLAG = /^--[a-z]/i;
const SHORT_FLAG = /^-[a-z]/i;

const isBoolFlag = (x: CliCommandInput): boolean => x.type === 'boolean' && !x.array;

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {

  static #schemas = new Map<Class, CliCommandSchema>();

  /**
   * Get schema for a given command
   */
  static async getSchema(cmd: CliCommandShape): Promise<CliCommandSchema> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;

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
    const { cls: _cls, preMain: _preMain, ...meta } = CliCommandRegistry.getConfig(cmd);
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
   * Produce the arguments into the final argument set
   */
  static async bindArgs(cmd: CliCommandShape, args: string[]): Promise<[known: unknown[], unknown: string[]]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;
    const [copy, extra] = split(args);
    const schema = await this.getSchema(cmd);
    const out: unknown[] = [];
    const found: boolean[] = copy.map(x => false);
    let i = 0;

    for (const el of schema.args) {
      // Siphon off unrecognized flags, in order
      while (i < copy.length && VALID_FLAG.test(copy[i])) {
        i += 1;
      }

      if (i >= copy.length) {
        out.push(el.array ? [] : undefined);
      } else if (el.array) {
        const sub: string[] = [];
        while (i < copy.length) {
          if (!VALID_FLAG.test(copy[i])) {
            sub.push(copy[i]);
            found[i] = true;
          }
          i += 1;
        }
        out.push(sub);
      } else {
        out.push(copy[i]);
        found[i] = true;
        i += 1;
      }
    }

    const final = [...copy.filter((_, idx) => !found[idx]), ...extra];
    return [
      BindUtil.coerceMethodParams(cls, 'main', out, true),
      final
    ];
  }

  /**
   * Bind arguments to command
   */
  static async bindFlags<T extends CliCommandShape>(cmd: T, args: string[]): Promise<string[]> {
    const schema = await this.getSchema(cmd);

    const [base, extra] = split(args);
    const copy = base.flatMap(k => (k.startsWith('--') && k.includes('=')) ? k.split('=') : [k]);

    const template: Partial<T> = {};

    const flagMap = new Map<string, CliCommandInput>();
    for (const flag of schema.flags) {
      for (const name of flag.flagNames ?? []) {
        flagMap.set(name, flag);
      }
      for (const envName of flag.envVars ?? []) {
        if (envName in process.env) {
          let val: string | string[] = process.env[envName]!;
          if (flag.array) {
            val = val.split(/\s*,\s*/g);
          }
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          template[flag.name as keyof T] = val as T[keyof T];
        }
      }
    }

    const out = [];
    for (let i = 0; i < copy.length; i += 1) {
      const arg = copy[i];
      const next = copy[i + 1];

      const input = flagMap.get(arg);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const key = input?.name as keyof T;
      if (!input) {
        out.push(arg);
      } else if (isBoolFlag(input)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        template[key] = !arg.startsWith('--no') as T[typeof key];
      } else if (next === undefined || VALID_FLAG.test(next)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        template[key] = null as T[typeof key];
      } else if (input.array) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const arr = template[key] ??= [] as T[typeof key];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (arr as unknown[]).push(next);
        i += 1; // Skip next
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        template[key] = next as T[typeof key];
        i += 1; // Skip next
      }
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const cls = cmd.constructor as Class<CliCommandShape>;
    BindUtil.bindSchemaToObject(cls, cmd, template);

    return [...out, '--', ...extra];
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