import { Class, ConsoleManager } from '@travetto/base';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { CliCommandInput, CliCommandSchema, CliCommandShape, CliValidationResultError, CliCommandMetaⲐ } from './types';

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

  /**
   * Get schema for a given command
   */
  static async getSchema(cmd: CliCommandShape): Promise<CliCommandSchema> {
    const cls = cmd[CliCommandMetaⲐ]!.cls;

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
      ConsoleManager.setDebugFromEnv();
    }

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

    const cfg = {
      args: method,
      flags,
      title: SchemaRegistry.get(cls).title ?? cls.name,
      name: cmd[CliCommandMetaⲐ]!.name,
      description: SchemaRegistry.get(cls).description ?? ''
    };
    this.#schemas.set(cls, cfg);
    return cfg;
  }

  /**
   * Produce the arguments into the final argument set
   */
  static async bindArgs(cmd: CliCommandShape, args: string[]): Promise<[known: unknown[], unknown: string[]]> {
    const cls = cmd[CliCommandMetaⲐ]!.cls;

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

    const final = [...copy.filter((_, idx) => !found[idx]), ...extra];
    return [
      BindUtil.coerceMethodParams(cls, 'main', out, true),
      final
    ];
  }

  /**
   * Bind arguments to command
   */
  static async bindFlags(cmd: CliCommandShape, args: string[]): Promise<string[]> {
    const schema = await this.getSchema(cmd);

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

    const cls = cmd[CliCommandMetaⲐ]!.cls;
    BindUtil.bindSchemaToObject(cls, cmd, template);

    return [...out, ...extra];
  }

  /**
   * Validate command shape with the given arguments
   */
  static async validate(cmd: CliCommandShape, args: unknown[]): Promise<typeof cmd> {
    const cls = cmd[CliCommandMetaⲐ]!.cls;

    const validators = [
      (): Promise<void> => SchemaValidator.validate(cls, cmd).then(() => { }),
      (): Promise<void> => SchemaValidator.validateMethod(cls, 'main', args),
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
      return err.errors.map(v => ({ ...v, message: `${v.message}. [${i}]`, index: i }));
    }));

    const errors = (await Promise.all(results)).flatMap(x => (x ?? []));
    if (errors.length) {
      throw new CliValidationResultError(errors);
    }
    return cmd;
  }
}