import { Class, classConstruct, describeFunction } from '@travetto/runtime';
import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { InputConfig, SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandInput, CliCommandConfig, CliCommandShape } from '../types.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');


const LONG_FLAG = /^--[a-z][^= ]+/i;
const SHORT_FLAG = /^-[a-z]/i;

const isBoolFlag = (x?: CliCommandInput): boolean => x?.type === 'boolean' && !x.array;

function baseType(x: InputConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
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

const fieldToInput = (x: InputConfig): CliCommandInput => ({
  ...baseType(x),
  ...(('name' in x && typeof x.name === 'string') ? { name: x.name } : { name: '' }),
  description: x.description,
  array: x.array,
  required: x.required?.active,
  choices: x.enum?.values,
  default: Array.isArray(x.default) ? x.default.slice(0) : x.default,
  flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
  envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
});

const combineClasses = (target: CliCommandConfig, ...sources: Partial<CliCommandConfig>[]): CliCommandConfig => {
  for (const source of sources) {
    Object.assign(target, source, {
      flags: [...(target.flags ?? []), ...(source.flags ?? [])],
      args: [...(target.args ?? []), ...(source.args ?? [])]
    });
  }
  return target;
};

export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {

  indexCls: RegistryIndexClass<CliCommandConfig>;
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  finalize(parentConfig?: CliCommandConfig): void {
    const schemaConfig = SchemaRegistryIndex.getConfig(this.#cls);
    const flags = Object.values(schemaConfig.fields).map(fieldToInput);

    // Add help command
    flags.push({ name: 'help', flagNames: ['h'], description: 'display help for command', type: 'boolean' });

    const method = schemaConfig.methods.main.parameters.map(fieldToInput);

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
    this.#config.flags = flags;
    this.#config.args = method;
    this.#config.description = this.#config.description || schemaConfig.description || parentConfig?.description || '';
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
      args: [],
      flags: [],
      hidden: false,
      preMain: undefined,
      title: '',
      name: getName(meta.import),
      commandModule: meta.module,
    };
    combineClasses(this.#config, ...cfg);
    return this.#config;
  }

  /**
   * Get instance of the command
   */
  getInstance(): CliCommandShape {
    const inst: CliCommandShape = classConstruct(this.#cls);
    inst._cfg = this.#config;
    return inst;
  }
}