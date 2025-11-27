import { Class } from '@travetto/runtime';
import { ChangeEvent, RegistryAdapter, RegistryIndex, RegistryIndexStore, RegistryV2 } from '@travetto/registry';

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

  register(...data: Partial<Partial<Group>>[]): Group {
    for (const d of data) {
      Object.assign(this.#config, {
        ...d,
        children: [
          ...(this.#config?.children ?? []),
          ...(d.children ?? [])
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
  static #instance = RegistryV2.registerIndex(SampleRegistryIndex);

  static getForRegister(cls: Class, allowFinalized = false): SampleRegistryAdapter {
    return this.#instance.store.getForRegister(cls, allowFinalized);
  }

  store = new RegistryIndexStore(SampleRegistryAdapter);

  process(events: ChangeEvent<Class>[]): void {
    // Nothing to do
  }

  finalize(cls: Class): void {
    this.store.finalize(cls);
  }
}