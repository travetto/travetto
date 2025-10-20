import { castTo, Class, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { RegistryAdapter, RegistryItem, RegistryIndex } from './types';

class Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  trace = false;
  #uid = Util.uuid();

  #items: Map<Class, RegistryItem> = new Map();
  #idToCls: Map<string, Class> = new Map();
  #itemsByIndex = new Map<RegistryIndex, Set<RegistryItem>>();
  #changeSource = new ClassSource();

  #item(cls: Class): RegistryItem {
    let item = this.#items.get(cls);
    if (!item) {
      item = new RegistryItem(cls);
      this.#items.set(cls, item);
      this.#idToCls.set(cls.Ⲑid, cls);
    }
    return item;
  }

  #adapter<C extends {} = {}, M extends {} = {}, F extends {} = {}>(cls: Class, index: RegistryIndex<C, M, F>): RegistryAdapter<C, M, F> {
    const item = this.#item(cls);
    if (!this.#itemsByIndex.has(index)) {
      this.#itemsByIndex.set(index, new Set());
    }
    this.#itemsByIndex.get(index)!.add(item);
    return this.#item(cls).get(index, cls);
  }

  #removeItem(cls: Class): void {
    const item = this.#items.get(cls);
    if (item) {
      for (const adapter of item.adapters.values()) {
        adapter.unregister();
        // Remove from itemsByIndex map
        this.#itemsByIndex.get(castTo(adapter.constructor))?.delete(item);
      }
      this.#items.delete(item.cls);
      this.#idToCls.delete(item.cls.Ⲑid);
    }
  }

  #finalizeItems(classes: Class[]): void {
    for (const cls of classes) {
      const item = this.#item(cls);
      if (!item.finalized) {
        item.finalize();
      }
    }
  }

  /**
   * Run initialization
   */
  async #init(): Promise<void> {
    try {
      this.#resolved = false;

      if (this.trace) {
        console.debug('Initializing', { uid: this.#uid });
      }

      const added = await this.#changeSource.init();
      this.#finalizeItems(added);

      this.#changeSource.on(e => {
        if (e.type === 'removing' || e.type === 'changed') {
          this.#removeItem(e.prev);
        }
        if (e.type === 'added' || e.type === 'changed') {
          this.#finalizeItems([e.curr]);
        }
      });
    } finally {
      this.#resolved = true;
    }
  }

  /**
   * Verify initialized state
   */
  verifyInitialized(): void {
    if (!this.#resolved) {
      throw new Error(`${this.constructor.name} has not been initialized, you probably need to call RootRegistry.init()`);
    }
  }

  /**
   * Initialize, with a built-in latch to prevent concurrent initializations
   */
  async init(): Promise<unknown> {
    if (this.trace) {
      console.debug('Trying to initialize', { uid: this.#uid, initialized: !!this.#initialized });
    }
    return this.#initialized ??= this.#init();
  }

  getRegisteredById(id: string): Class | undefined {
    return this.#idToCls.get(id);
  }

  register<C extends {}>(index: RegistryIndex<C>, cls: Class, data?: Partial<C>): void {
    this.#adapter(cls, index).register(data ?? {});
  }

  registerField<F extends {}>(index: RegistryIndex<{}, {}, F>, cls: Class, field: string | symbol, data: Partial<F>): void {
    this.#adapter(cls, index).registerField(field, data ?? {});
  }

  registerMethod<M extends {}>(index: RegistryIndex<{}, M, {}>, cls: Class, method: string | symbol, data: Partial<M>): void {
    this.#adapter(cls, index).registerMethod(method, data ?? {});
  }

  get<C extends {}>(index: RegistryIndex<C>, cls: Class): C {
    return this.#adapter(cls, index).get();
  }

  getField<F extends {}>(index: RegistryIndex<{}, {}, F>, cls: Class, field: string | symbol): F {
    return this.#adapter(cls, index).getField(field);
  }

  getMethod<M extends {}>(index: RegistryIndex<{}, M, {}>, cls: Class, method: string | symbol): M {
    return this.#adapter(cls, index).getMethod(method);
  }
}

export const RegistryV2 = new Registry();