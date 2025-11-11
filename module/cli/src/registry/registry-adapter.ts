import { AppError, Class, classConstruct, describeFunction } from '@travetto/runtime';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { RegistryAdapter, RegistryIndexClass } from 'module/registry/__index__.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');

export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {

  indexCls: RegistryIndexClass<CliCommandConfig>;
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  finalize(parent?: CliCommandConfig | undefined): void {
    // Do nothing
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
      name: getName(meta.import),
      commandModule: meta.module,
    };
    Object.assign(this.#config, ...cfg);
    return this.#config;
  }

  /**
   * Get the name of a command from a given instance
   */
  getName(withModule = false): string | undefined {
    const prefix = withModule ? `${this.#config.commandModule}:` : '';
    return `${prefix}${this.#config.name}`;
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