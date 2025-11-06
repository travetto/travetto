import { EventEmitter } from 'node:events';
import { AppError, castTo, Class, ClassInstance, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { RegistryItem, RegistryIndex, RegistryIndexClass, ClassOrId, RegistrationMethods } from './types';
import { ChangeEvent } from '../types';
import { MethodSource } from '../source/method-source';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  trace = false;
  #uid = Util.uuid();

  #items: Map<Class, RegistryItem> = new Map();
  #idToCls: Map<string, Class> = new Map();
  #itemsByIndex = new Map<RegistryIndexClass, Map<Class, RegistryItem>>();
  #classSource = new ClassSource();
  #methodSource?: MethodSource;
  #indexes = new Map<RegistryIndexClass, RegistryIndex<{}>>();

  #emitter = new EventEmitter<{ event: [ChangeEvent<Class>] }>();

  #matchesEvent(event: ChangeEvent<Class>, matches: RegistryIndexClass): boolean {
    return ('curr' in event && this.has(matches, event.curr)) ||
      ('prev' in event && this.has(matches, event.prev));
  }

  #matchesMethodEvent(event: ChangeEvent<[Class, Function]>, matches: RegistryIndexClass): boolean {
    return ('curr' in event && this.has(matches, event.curr[0])) ||
      ('prev' in event && this.has(matches, event.prev[0]));
  }

  #item(cls: Class): RegistryItem {
    let item = this.#items.get(cls);
    if (!item) {
      item = new RegistryItem(cls);
      this.#items.set(cls, item);
      this.#idToCls.set(cls.Ⲑid, cls);
    }
    return item;
  }

  #adapter<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    cls: Class,
  ): ReturnType<InstanceType<T>['adapter']> {
    if (!this.#indexes.has(indexCls)) {
      this.#indexes.set(indexCls, new indexCls());
    }

    const index: RegistryIndex<C> = castTo(this.#indexes.get(indexCls));

    const item = this.#item(cls);
    if (!this.#itemsByIndex.has(indexCls)) {
      this.#itemsByIndex.set(indexCls, new Map());
    }
    this.#itemsByIndex.get(indexCls)!.set(cls, item);
    return castTo(this.#item(cls).adapter(index, cls));
  }

  #readonlyAdapter<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    cls: Class,
  ): Extract<ReturnType<InstanceType<T>['adapter']>, 'get' | `get${string}`> {
    if (!this.has(indexCls, cls)) {
      throw new AppError(`Class ${cls} is not registered in index ${indexCls}`);
    }
    const index: RegistryIndex<C> = castTo(this.#indexes.get(indexCls));
    return castTo(this.#item(cls).readonlyAdapter(index, cls));
  }

  #removeItem(cls: Class): void {
    const item = this.#items.get(cls);
    if (item) {
      for (const adapter of item.adapters.values()) {
        // Remove from itemsByIndex map
        this.#itemsByIndex.get(adapter.indexCls)?.delete(item.cls);
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

  process(events: ChangeEvent<Class>[]): void {
    for (const e of events) {
      if (e.type === 'added' || e.type === 'changed') {
        this.#finalizeItems([e.curr]);
      }
      for (const index of this.#indexes.values()) { // Visit every index
        if (this.#matchesEvent(e, castTo(index.constructor))) {
          index.process([e]);
        }
      }

      this.#emitter.emit('event', e);

      if (e.type === 'removing' || e.type === 'changed') {
        this.#removeItem(e.prev);
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

      const added = await this.#classSource.init();
      this.#finalizeItems(added);

      this.#classSource.on(e => this.process([e]));
    } finally {
      this.#resolved = true;
    }
  }

  #toCls(clsOrId: Class | string | ClassInstance): Class {
    if (typeof clsOrId === 'string') {
      const cls = this.#idToCls.get(clsOrId);
      if (!cls) {
        throw new AppError(`Unknown class id ${clsOrId}`);
      }
      return cls;
    } else {
      return 'Ⲑid' in clsOrId ? clsOrId : clsOrId.constructor;
    }
  }

  /**
   * Verify initialized state
   */
  verifyInitialized(): void {
    if (!this.#resolved) {
      throw new Error(`${this.constructor.name} has not been initialized, you probably need to call RegistryV2.init()`);
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

  getForRegister<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    clsOrId: ClassOrId
  ): ReturnType<InstanceType<T>['adapter']> {
    const cls = this.#toCls(clsOrId);
    return this.#adapter(indexCls, cls);
  }

  get<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    clsOrId: ClassOrId
  ): Omit<ReturnType<InstanceType<T>['adapter']>, RegistrationMethods> {
    const cls = this.#toCls(clsOrId);
    return this.#readonlyAdapter(indexCls, cls);
  }

  getClasses<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T
  ): Class[] {
    return Array.from(this.#itemsByIndex.get(indexCls)?.keys() ?? []);
  }

  instance<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T
  ): InstanceType<T> {
    return castTo(this.#indexes.get(indexCls));
  }

  /**
   * Is class found by id or by Class
   */
  has<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    clsOrId: ClassOrId
  ): boolean {
    const cls = this.#toCls(clsOrId);
    return this.#itemsByIndex.get(indexCls)?.has(cls) ?? false;
  }

  /**
   * Listen for changes
   */
  onClassChange(handler: (event: ChangeEvent<Class>) => void, matches?: RegistryIndexClass): void {
    this.#emitter.on('event', (event) => {
      if (!matches || this.#matchesEvent(event, matches)) {
        handler(event);
      }
    });
  }

  onNonClassChanges(handler: (file: string) => void): void {
    this.#classSource.onNonClassChanges(handler);
  }

  onMethodChange(
    handler: (event: ChangeEvent<[Class, Function]>) => void,
    matches?: RegistryIndexClass,
  ): void {
    const src = this.#methodSource ??= new MethodSource(this.#classSource);
    src.on(event => {
      if (!matches || this.#matchesMethodEvent(event, matches)) {
        handler(event);
      }
    });
  }
}

export const RegistryV2 = new $Registry();