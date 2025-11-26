import { Class, classConstruct, describeFunction } from '@travetto/runtime';
import { RegistryAdapter } from '@travetto/registry';
import { SchemaInputConfig, SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandConfig, CliCommandShape } from '../types.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const LONG_FLAG = /^--[a-z][^= ]+/i;
const SHORT_FLAG = /^-[a-z]/i;
const ENV_PREFIX = 'env.';

const isBoolFlag = (x?: SchemaInputConfig): boolean => x?.type === Boolean && !x.array;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');


export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  finalize(): void {
    // Add help command
    const schema = SchemaRegistryIndex.getConfig(this.#cls);

    const used = new Set(Object.values(schema.fields)
      .flatMap(f => f.aliases ?? [])
      .filter(x => SHORT_FLAG.test(x) || x.replaceAll('-', '').length < 3)
      .map(x => x.replace(/^-+/, ''))
    );

    for (const field of Object.values(schema.fields)) {
      const fieldName = field.name.toString();
      const withoutEnv = (field.aliases ?? []).filter(x => !x.startsWith(ENV_PREFIX));

      let short = withoutEnv.find(x => SHORT_FLAG.test(x) || x.replaceAll('-', '').length < 3)?.replace(/^-+/, '');
      const long = withoutEnv.find(x => LONG_FLAG.test(x) || x.replaceAll('-', '').length > 2)?.replace(/^-+/, '') ||
        fieldName.replace(/([a-z])([A-Z])/g, (_, l, r: string) => `${l}-${r.toLowerCase()}`);

      const aliases: string[] = field.aliases ??= [];

      if (short === undefined) {
        if (!(isBoolFlag(field) && field.default === true)) {
          short = fieldName.charAt(0);
          if (!used.has(short)) {
            aliases.push(`-${short}`);
            used.add(short);
          }
        }
      } else {
        aliases.push(`-${short}`);
      }

      aliases.push(`--${long}`);

      if (isBoolFlag(field)) {
        aliases.push(`--no-${long}`);
      }
      // Remove noise when done
      field.aliases = field.aliases
        .filter(x => x.startsWith('-') || x.startsWith(ENV_PREFIX));
    }

    // Add help to every command
    (schema.fields ??= {}).help = {
      type: Boolean,
      name: 'help',
      owner: this.#cls,
      description: 'display help for command',
      required: { active: false },
      access: 'readonly',
      aliases: ['-h', '--help']
    };
  }

  get(): CliCommandConfig {
    return this.#config;
  }

  /**
   * Registers a cli command
   */
  register(...cfg: Partial<CliCommandConfig>[]): CliCommandConfig {
    const meta = describeFunction(this.#cls);
    this.#config ??= {
      cls: this.#cls,
      preMain: undefined,
      name: getName(meta.import),
    };
    Object.assign(this.#config, ...cfg);
    return this.#config;
  }

  /**
   * Get instance of the command
   */
  getInstance(): CliCommandShape {
    const instance: CliCommandShape = classConstruct(this.#cls);
    instance._cfg = this.#config;
    return instance;
  }
}