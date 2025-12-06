import { Class, getClass, getParentClass, isClass, Runtime, RuntimeIndex } from '@travetto/runtime';
import { RegistryAdapter, RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { SchemaClassConfig, SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliUnknownCommandError } from '../error.ts';
import { CliCommandRegistryAdapter } from './registry-adapter.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (field: string): string => (field.match(CLI_FILE_REGEX)?.groups?.name ?? field).replaceAll('_', ':');

type CliCommandLoadResult = { command: string, config: CliCommandConfig, instance: CliCommandShape, schema: SchemaClassConfig };

export class CliCommandRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(this);

  static getForRegister(cls: Class): RegistryAdapter<CliCommandConfig> {
    return this.#instance.store.getForRegister(cls);
  }

  static get(cls: Class): CliCommandConfig {
    return this.#instance.store.get(cls).get();
  }

  static load(names?: string[]): Promise<CliCommandLoadResult[]> {
    return this.#instance.load(names);
  }

  #fileMapping: Map<string, string>;
  #instanceMapping: Map<string, CliCommandShape> = new Map();

  store = new RegistryIndexStore(CliCommandRegistryAdapter);

  constructor(source: unknown) { Registry.validateConstructor(source); }

  /**
   * Get list of all commands available
   */
  get #commandMapping(): Map<string, string> {
    if (!this.#fileMapping) {
      const all = new Map<string, string>();
      for (const entry of RuntimeIndex.find({
        module: mod => !Runtime.production || mod.prod,
        folder: folder => folder === 'support',
        file: file => file.role === 'std' && CLI_FILE_REGEX.test(file.sourceFile)
      })) {
        all.set(getName(entry.sourceFile), entry.import);
      }
      this.#fileMapping = all;
    }
    return this.#fileMapping;
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
      .filter(isClass)
      .reduce<Class[]>((classes, cls) => {
        const parent = getParentClass(cls);
        if (parent && !classes.includes(parent)) {
          classes.push(parent);
        }
        classes.push(cls);
        return classes;
      }, []);

    const uninitialized = filtered
      .filter(cls => !this.store.finalized(cls));


    // Initialize any uninitialized commands
    if (uninitialized.length) {
      // Ensure processed
      Registry.process(uninitialized.map(cls => ({ type: 'create', current: cls })));
    }

    for (const cls of values) {
      const config = this.store.get(cls);
      if (!config) {
        continue;
      }
      const result = config.getInstance();
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

    const list = await Promise.all(keys.map(async key => {
      const instance = await this.#getInstance(key);
      const config = this.store.get(getClass(instance)).get();
      const schema = SchemaRegistryIndex.getConfig(getClass(instance));
      return { command: key, instance, config, schema };
    }));

    return list.sort((a, b) => a.command.localeCompare(b.command));
  }
}