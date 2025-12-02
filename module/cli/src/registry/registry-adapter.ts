import { Class, classConstruct, describeFunction } from '@travetto/runtime';
import { RegistryAdapter } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliParseUtil, ENV_PREFIX } from '../parse.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;

const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');
const stripDashes = (x?: string): string | undefined => x?.replace(/^-+/, '');
const toFlagName = (x: string): string => x.replace(/([a-z])([A-Z])/g, (_, left: string, right: string) => `${left}-${right.toLowerCase()}`);

export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  finalize(): void {
    // Add help command
    const schema = SchemaRegistryIndex.getConfig(this.#cls);

    // Add help to every command
    (schema.fields ??= {}).help = {
      type: Boolean,
      name: 'help',
      owner: this.#cls,
      description: 'display help for command',
      required: { active: false },
      default: false,
      access: 'readonly',
      aliases: ['-h', '--help']
    };

    const used = new Set(Object.values(schema.fields)
      .flatMap(f => f.aliases ?? [])
      .filter(x => !x.startsWith(ENV_PREFIX))
      .map(stripDashes)
    );

    for (const field of Object.values(schema.fields)) {
      const fieldName = field.name.toString();
      const { long: longAliases, short: shortAliases, raw: rawAliases, env: envAliases } = CliParseUtil.parseAliases(field.aliases ?? []);

      let short = stripDashes(shortAliases?.[0]) ?? rawAliases.find(x => x.length <= 2);
      const long = stripDashes(longAliases?.[0]) ?? rawAliases.find(x => x.length >= 3) ?? toFlagName(fieldName);
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
  }

  get(): CliCommandConfig {
    return this.#config;
  }

  /**
   * Registers a cli command
   */
  register(...config: Partial<CliCommandConfig>[]): CliCommandConfig {
    const meta = describeFunction(this.#cls);
    this.#config ??= {
      cls: this.#cls,
      preMain: undefined,
      name: getName(meta.import),
    };
    Object.assign(this.#config, ...config);
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