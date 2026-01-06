import type { Class } from '@travetto/runtime';
import { type RegistryAdapter, type RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';

interface Group {
  class: Class;
  name: string;
  children: Child[];
}

interface Child {
  name: string;
  method: Function;
}

/**
 * The adapter to handle mapping/modeling a specific class
 */
class SampleRegistryAdapter implements RegistryAdapter<Group> {

  #class: Class;
  #config: Group;

  constructor(cls: Class) {
    this.#class = cls;
  }

  register(...groups: Partial<Partial<Group>>[]): Group {
    for (const group of groups) {
      Object.assign(this.#config, {
        ...group,
        children: [
          ...(this.#config?.children ?? []),
          ...(group.children ?? [])
        ]
      });
    }
    return this.#config;
  }

  registerChild(method: Function, name: string): void {
    this.register({ children: [{ method, name }] });
  }

  finalize?(parent?: Partial<Group> | undefined): void {
    // Nothing to do
  }

  get(): Group {
    return this.#config;
  }
}

/**
 * Basic Index that handles cross-class activity
 */
export class SampleRegistryIndex implements RegistryIndex {
  static #instance = Registry.registerIndex(SampleRegistryIndex);

  static getForRegister(cls: Class, allowFinalized = false): SampleRegistryAdapter {
    return this.#instance.store.getForRegister(cls, allowFinalized);
  }

  store = new RegistryIndexStore(SampleRegistryAdapter);

  onCreate(cls: Class): void {
    // Nothing to do
  }
}