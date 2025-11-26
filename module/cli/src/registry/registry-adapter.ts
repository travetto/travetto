import { Class, classConstruct, describeFunction } from '@travetto/runtime';
import { RegistryAdapter } from '@travetto/registry';

import { CliCommandConfig, CliCommandShape } from '../types.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');

export class CliCommandRegistryAdapter implements RegistryAdapter<CliCommandConfig> {
  #cls: Class;
  #config: CliCommandConfig;

  constructor(cls: Class) {
    this.#cls = cls;
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