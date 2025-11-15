import { Class, classConstruct, describeFunction } from '@travetto/runtime';
import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliCommandRegistryUtil } from './util.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');


const combineClasses = (target: CliCommandConfig, ...sources: Partial<CliCommandConfig>[]): CliCommandConfig => {
  for (const source of sources) {
    Object.assign(target, source, {
      flags: [...(target.flags ?? []), ...(source.flags ?? [])],
      args: [...(target.args ?? []), ...(source.args ?? [])],
      description: source.description || target.description,
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
    const title = this.#config.title || schemaConfig.title || parentConfig?.title || '';
    const description = this.#config.description || schemaConfig.description || parentConfig?.description || '';
    const schema = CliCommandRegistryUtil.buildSchema(schemaConfig);
    combineClasses(this.#config, parentConfig ?? {}, schema, { title, description });
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