import { AppError, castTo, Class, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { RegistryItem, RegistryIndex, RegistryIndexClass } from './types';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  trace = false;
  #uid = Util.uuid();

  #items: Map<Class, RegistryItem> = new Map();
  #idToCls: Map<string, Class> = new Map();
  #itemsByIndex = new Map<RegistryIndexClass, Set<RegistryItem>>();
  #changeSource = new ClassSource();
  #indexes = new Map<RegistryIndexClass, RegistryIndex>();

  #item(cls: Class): RegistryItem {
    let item = this.#items.get(cls);
    if (!item) {
      item = new RegistryItem(cls);
      this.#items.set(cls, item);
      this.#idToCls.set(cls.Ⲑid, cls);
    }
    return item;
  }

  #adapter<C extends {}, M extends {}, F extends {}, T extends RegistryIndexClass<C, M, F>>(indexCls: T, cls: Class): ReturnType<InstanceType<T>['adapter']> {
    if (!this.#indexes.has(indexCls)) {
      this.#indexes.set(indexCls, new indexCls());
    }

    const index: RegistryIndex<C, M, F> = castTo(this.#indexes.get(indexCls));

    const item = this.#item(cls);
    if (!this.#itemsByIndex.has(indexCls)) {
      this.#itemsByIndex.set(indexCls, new Set());
    }
    this.#itemsByIndex.get(indexCls)!.add(item);
    return castTo(this.#item(cls).adapter(index, cls));
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

  get<C extends {}, M extends {}, F extends {}, T extends RegistryIndexClass<C, M, F>>(indexCls: T, clsOrId: Class | string): ReturnType<InstanceType<T>['adapter']> {
    const cls = typeof clsOrId === 'string' ? this.#idToCls.get(clsOrId) : clsOrId;
    if (!cls) {
      throw new AppError(`Unknown class ${clsOrId}`);
    }
    return this.#adapter(indexCls, cls);
  }
}

export const RegistryV2 = new $Registry();