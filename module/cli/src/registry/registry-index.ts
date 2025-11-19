import { Class, getParentClass, Runtime, RuntimeIndex } from '@travetto/runtime';
import { ClassOrId, RegistryAdapter, RegistryIndexStore, RegistryV2 } from '@travetto/registry';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliUnknownCommandError } from '../error.ts';
import { CliCommandRegistryAdapter } from './registry-adapter.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');

type CliCommandLoadResult = { command: string, config: CliCommandConfig, instance: CliCommandShape };

export class CliCommandRegistryIndex {

  static #instance = RegistryV2.registerIndex(this);

  static getForRegister(clsOrId: ClassOrId): RegistryAdapter<CliCommandConfig> {
    return this.#instance.store.getForRegister(clsOrId);
  }

  static get(clsOrId: ClassOrId): CliCommandConfig {
    return this.#instance.store.get(clsOrId).get();
  }

  static load(names?: string[]): Promise<CliCommandLoadResult[]> {
    return this.#instance.load(names);
  }

  #fileMapping: Map<string, string>;
  #instanceMapping: Map<string, CliCommandShape> = new Map();

  store = new RegistryIndexStore(CliCommandRegistryAdapter);

  /**
   * Get list of all commands available
   */
  get #commandMapping(): Map<string, string> {
    if (!this.#fileMapping) {
      const all = new Map<string, string>();
      for (const e of RuntimeIndex.find({
        module: m => !Runtime.production || m.prod,
        folder: f => f === 'support',
        file: f => f.role === 'std' && CLI_FILE_REGEX.test(f.sourceFile)
      })) {
        all.set(getName(e.sourceFile), e.import);
      }
      this.#fileMapping = all;
    }
    return this.#fileMapping;
  }


  process(): void {
    // Do nothing for now?
  }

  /**
   * Import command into an instance
   */
  async #getInstance(name: string): Promise<CliCommandShape> {
    if (!this.hasCommand(name)) {
      throw new CliUnknownCommandError(name);
    }

    if (this.#instanceMapping.has(name)) {
      return this.#instanceMapping.get(name)!;
    }

    const found = this.#commandMapping.get(name)!;
    const values = Object.values(await Runtime.importFrom<Record<string, Class>>(found));
    const filtered = values
      .filter((v): v is Class => typeof v === 'function')
      .reduce<Class[]>((acc, v) => {
        const parent = getParentClass(v);
        if (parent && !acc.includes(parent)) {
          acc.push(parent);
        }
        acc.push(v);
        return acc;
      }, []);

    const uninitialized = filtered
      .filter(v => !this.store.finalized(v));


    // Initialize any uninitialized commands
    if (uninitialized.length) {
      // Ensure processed
      RegistryV2.process(uninitialized.map(v => ({ type: 'added', curr: v })));
    }

    for (const v of values) {
      const cfg = this.store.get(v);
      if (!cfg) {
        continue;
      }
      const result = cfg.getInstance();
      if (result.isActive !== undefined && !result.isActive()) {
        continue;
      }
      this.#instanceMapping.set(name, result);
      return result;
    }
    throw new CliUnknownCommandError(name);
  }

  hasCommand(name: string): boolean {
    return this.#commandMapping.has(name);
  }

  async load(names?: string[]): Promise<CliCommandLoadResult[]> {
    const keys = names ?? [...this.#commandMapping.keys()];

    const list = await Promise.all(keys.map(async x => {
      const instance = await this.#getInstance(x);
      const config = this.store.get(instance).get();
      return { command: x, instance, config };
    }));

    return list.sort((a, b) => a.command.localeCompare(b.command));
  }
}