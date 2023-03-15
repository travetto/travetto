import { Class } from '@travetto/base';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { CliCommandInput, CliCommandSchema, CliCommandShape } from './types';

function fieldToInput(x: FieldConfig): CliCommandInput {
  return ({
    name: x.name,
    description: x.description,
    array: x.array,
    required: x.required?.active,
    choices: x.enum?.values,
    type: x.type === Boolean ? 'boolean' :
      x.type === String ? 'string' :
        x.type === Number ? 'number' :
          x.type === RegExp ? 'regex' : 'string',
    default: x.default,
    flagNames: (x.aliases ?? []).slice(0)
  });
}

const isBoolFlag = (x: CliCommandInput): boolean => x.type === 'boolean' && !x.array;

/**
 * Allows binding describing/binding inputs for commands
 */
export class CliCommandSchemaUtil {

  static #schemas = new Map<Class, CliCommandSchema>();

  static #getClass(cmd: CliCommandShape): Class<CliCommandShape> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cmd.constructor as Class;
  }

  /**
   * Get schema for a given command
   */
  static async getSchema(cmd: CliCommandShape): Promise<CliCommandSchema> {
    const cls = this.#getClass(cmd);

    if (this.#schemas.has(cls)) {
      return this.#schemas.get(cls)!;
    }

    // Ensure finalized
    const parent = SchemaRegistry.getParentClass(cls);
    if (parent?.Ⲑid) {
      SchemaRegistry.install(parent, { type: 'added', curr: parent });
    }
    SchemaRegistry.install(cls, { type: 'added', curr: cls });

    const schema = await SchemaRegistry.getViewSchema(cls);
    const flags = [...Object.values(schema.schema)].filter(v => !v.forMethod).map(fieldToInput);

    // Add help command
    flags.push({ name: 'help', flagNames: ['h'], description: 'display help for command', type: 'boolean' });

    const method = SchemaRegistry.getMethodSchema(cls, 'main').map(fieldToInput);

    const used = new Set(flags
      .flatMap(f => f.flagNames ?? [])
      .filter(x => /^-[^-]/.test(x) || x.replaceAll('-', '').length < 3)
      .map(x => x.replace(/^-+/, ''))
    );

    for (const flag of flags) {
      let short = (flag.flagNames ?? []).find(x => /^-[^-]/.test(x) || x.replaceAll('-', '').length < 3)?.replace(/^-+/, '');
      const long = (flag.flagNames ?? []).find(x => /^--[^-]/.test(x) || x.replaceAll('-', '').length > 2)?.replace(/^-+/, '') ??
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

    const cfg = { args: method, flags, title: SchemaRegistry.get(cls).title ?? '' };
    this.#schemas.set(cls, cfg);
    return cfg;
  }

  /**
   * Produce the arguments into the final argument set
   */
  static async getArgs(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    const restIdx = args.indexOf('--');
    const copy = [...args.slice(0, restIdx < 0 ? args.length : restIdx)];
    const extra = restIdx < 0 ? [] : args.slice(restIdx);
    const schema = await this.getSchema(cmd);
    const out: unknown[] = [];
    const found: boolean[] = copy.map(x => false);
    let i = 0;

    for (const el of schema.args) {
      // Siphon off unrecognized flags, in order
      while (i < copy.length && copy[i].startsWith('-')) {
        i += 1;
      }

      if (i >= copy.length) {
        out.push(el.array ? [] : undefined);
      } else if (el.array) {
        const sub: string[] = [];
        while (i < copy.length) {
          if (!copy[i].startsWith('-')) {
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

    return [...out, [...copy.filter((_, idx) => !found[idx]), ...extra]];
  }

  /**
   * Bind arguments to command
   */
  static async bindFlags(cmd: CliCommandShape, args: string[]): Promise<string[]> {
    const schema = await this.getSchema(cmd);
    await cmd.initializeFlags?.();

    const restIdx = args.indexOf('--');
    const copy = [...args.slice(0, restIdx < 0 ? args.length : restIdx)]
      .flatMap(k => (k.startsWith('--') && k.includes('=')) ? k.split('=') : [k]);
    const extra = restIdx < 0 ? [] : args.slice(restIdx);

    const flagMap = new Map<string, CliCommandInput>();
    for (const flag of schema.flags) {
      for (const name of flag.flagNames ?? []) {
        flagMap.set(name, flag);
      }
    }

    const out = [];
    const template: any = {};
    for (let i = 0; i < copy.length; i += 1) {
      const arg = copy[i];
      const next = copy[i + 1];

      const input = flagMap.get(arg);
      if (!input) {
        out.push(arg);
      } else if (isBoolFlag(input)) {
        template[input.name] = !arg.startsWith('--no');
      } else if (next === undefined || next.startsWith('-')) {
        template[input.name] = null;
      } else if (input.array) {
        template[input.name] ??= [];
        template[input.name].push(next);
        i += 1; // Skip next
      } else {
        template[input.name] = next;
        i += 1; // Skip next
      }
    }

    const cls = this.#getClass(cmd);
    BindUtil.bindSchemaToObject(cls, cmd, template);
    await cmd.finalizeFlags?.();

    return [...out, ...extra];
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(cmd: CliCommandShape, args: unknown[]): Promise<typeof cmd> {
    const cls = this.#getClass(cmd);
    const validators = [
      async (): Promise<void> => { await SchemaValidator.validate(cls, cmd); },
      async (): Promise<void> => { await SchemaValidator.validateMethod(cls, 'main', args); },
      async (): Promise<void> => {
        const res = await cmd.validate?.(...args);
        if (res) {
          throw new ValidationResultError(Array.isArray(res) ? res : [res]);
        }
      },
    ];

    const results = validators.map((x, i) => x().catch(err => {
      if (!(err instanceof ValidationResultError)) {
        throw err;
      }
      return err.errors.map(v => ({ ...v, index: i }));
    }));

    const errors = (await Promise.all(results)).flatMap(x => (x ?? []));
    if (errors.length) {
      throw new ValidationResultError(errors);
    }
    return cmd;
  }
}