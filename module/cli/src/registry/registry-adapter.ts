import { type Class, classConstruct, describeFunction } from '@travetto/runtime';
import type { RegistryAdapter } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliParseUtil, ENV_PREFIX } from '../parse.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;

const getName = (name: string): string => (name.match(CLI_FILE_REGEX)?.groups?.name ?? name).replaceAll('_', ':');
const stripDashes = (flag?: string): string | undefined => flag?.replace(/^-+/, '');
const toFlagName = (field: string): string => field.replace(/([a-z])([A-Z])/g, (_, left: string, right: string) => `${left}-${right.toLowerCase()}`);

function combineClasses(base: CliCommandConfig, ...configs: Partial<CliCommandConfig>[]): CliCommandConfig {
  for (const config of configs) {
    base.runTarget = config.runTarget ?? base.runTarget;
    if (config.preMain) {
      base.preMain = [...base.preMain ?? [], ...config.preMain ?? []];
    }
  }
  return base;
}

export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  finalize(parent?: CliCommandConfig): void {
    // Add help command
    const schema = SchemaRegistryIndex.getConfig(this.#cls);

    // Add help to every command
    (schema.fields ??= {}).help = {
      type: Boolean,
      name: 'help',
      class: this.#cls,
      description: 'display help for command',
      required: { active: false },
      default: false,
      access: 'readonly',
      aliases: ['-h', '--help']
    };

    const used = new Set(Object.values(schema.fields)
      .flatMap(field => field.aliases ?? [])
      .filter(alias => !alias.startsWith(ENV_PREFIX))
      .map(stripDashes)
    );

    for (const field of Object.values(schema.fields)) {
      const fieldName = field.name;
      const { long: longAliases, short: shortAliases, raw: rawAliases, env: envAliases } = CliParseUtil.parseAliases(field.aliases ?? []);

      let short = stripDashes(shortAliases?.[0]) ?? rawAliases.find(alias => alias.length <= 2);
      const long = stripDashes(longAliases?.[0]) ?? rawAliases.find(alias => alias.length >= 3) ?? toFlagName(fieldName);
      const aliases: string[] = field.aliases = [...envAliases];

      if (short === undefined) {
        short = fieldName.charAt(0);
        if (!used.has(short)) {
          aliases.push(`-${short}`);
          used.add(short);
        }
      } else {
        aliases.push(`-${short}`);
      }

      aliases.push(`--${long}`);

      if (field.type === Boolean) {
        aliases.push(`--no-${long}`);
      }
    }

    if (parent) {
      this.#config.preMain = [...this.#config.preMain, ...parent?.preMain ?? []];
    }

    // Sort
    this.#config.preMain = this.#config.preMain.toSorted((left, right) => left.priority - right.priority);
  }

  get(): CliCommandConfig {
    return this.#config;
  }

  /**
   * Registers a cli command
   */
  register(...configs: Partial<CliCommandConfig>[]): CliCommandConfig {
    const metadata = describeFunction(this.#cls);
    this.#config ??= { cls: this.#cls, name: getName(metadata.import), preMain: [], runTarget: true };
    return combineClasses(this.#config, ...configs);
  }

  /**
   * Get instance of the command
   */
  getInstance(): CliCommandShape {
    return classConstruct(this.#cls);
  }
}