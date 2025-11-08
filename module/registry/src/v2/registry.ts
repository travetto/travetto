import { EventEmitter } from 'node:events';
import { AppError, castTo, Class, ClassInstance, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { RegistryIndex, RegistryIndexClass, ClassOrId, RegistrationMethods, RegistryAdapter } from './types';
import { ChangeEvent } from '../types';
import { MethodSource } from '../source/method-source';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  trace = false;
  #uid = Util.uuid();

  // Core data
  #adapters = new Map<Class, Map<RegistryIndexClass, RegistryAdapter>>();
  #finalized = new Map<Class, boolean>();

  // Lookups
  #idToCls = new Map<string, Class>();
  #adaptersByIndex = new Map<RegistryIndexClass, Map<Class, RegistryAdapter>>();
  #indexes = new Map<RegistryIndexClass, RegistryIndex<{}>>();

  // Eventing
  #classSource = new ClassSource();
  #methodSource?: MethodSource;
  #emitter = new EventEmitter<{ event: [ChangeEvent<Class>] }>();

  #matchesEvent(event: ChangeEvent<Class>, matches: RegistryIndexClass): boolean {
    return ('curr' in event && this.has(matches, event.curr)) ||
      ('prev' in event && this.has(matches, event.prev));
  }

  #matchesMethodEvent(event: ChangeEvent<[Class, Function]>, matches: RegistryIndexClass): boolean {
    return ('curr' in event && this.has(matches, event.curr[0])) ||
      ('prev' in event && this.has(matches, event.prev[0]));
  }

  #removeItem(cls: Class): void {
    for (const adapter of this.#adapters.get(cls)?.values() ?? []) {
      // Remove from itemsByIndex map
      this.#adaptersByIndex.get(adapter.indexCls)?.delete(cls);
    }
    this.#adapters.delete(cls);
    this.#idToCls.delete(cls.Ⲑid);
    this.#finalized.delete(cls);
  }

  #adapter<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    clsOrId: ClassOrId,
  ): ReturnType<InstanceType<T>['adapter']> {
    const cls = this.#toCls(clsOrId);
    if (!this.#adapters.has(cls)) {
      this.#adapters.set(cls, new Map());
    }
    if (!this.#adaptersByIndex.has(indexCls)) {
      this.#adaptersByIndex.set(indexCls, new Map());
    }
    if (!this.#adapters.get(cls)!.has(indexCls)) {
      const adapter = this.instance(indexCls).adapter(cls);
      adapter.indexCls = indexCls;
      this.#adapters.get(cls)!.set(indexCls, adapter);
      this.#idToCls.set(cls.Ⲑid, cls);
      this.#adaptersByIndex.get(indexCls)!.set(cls, adapter);
    }

    return castTo(this.#adapters.get(cls)!.get(indexCls)!);
  }

  #finalizeItems(classes: Class[]): void {
    for (const cls of classes) {
      if (this.#finalized.get(cls)) {
        continue;
      }
      for (const adapter of this.#adapters.get(cls)?.values() ?? []) {
        const inst = this.instance(adapter.indexCls);
        const parentClass = inst.getParentClass?.(cls);
        let parentConfig;
        if (parentClass && this.#adapters.has(parentClass) && this.#adapters.get(parentClass)!.has(adapter.indexCls)) {
          parentConfig = this.#adapter(adapter.indexCls, parentClass).get();
        }
        adapter.finalize(parentConfig);
      }
      this.#finalized.set(cls, true);
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
      throw new AppError('Registry not initialized, call init() first');
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
    clsOrId: ClassOrId,
  ): ReturnType<InstanceType<T>['adapter']> {
    const cls = this.#toCls(clsOrId);

    if (this.#finalized.get(cls)) {
      throw new AppError(`Class ${cls.Ⲑid} is already finalized`);
    }
    return this.#adapter(indexCls, cls);
  }

  get<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T,
    clsOrId: ClassOrId
  ): Omit<ReturnType<InstanceType<T>['adapter']>, RegistrationMethods> {
    if (!this.has(indexCls, clsOrId)) {
      const cls = this.#toCls(clsOrId);
      throw new AppError(`Class ${cls.Ⲑid} is not registered in index ${indexCls.Ⲑid}`);
    }
    return this.#adapter(indexCls, clsOrId);
  }

  getClasses<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T
  ): Class[] {
    return Array.from(this.#adaptersByIndex.get(indexCls)?.keys() ?? []);
  }

  instance<C extends {}, T extends RegistryIndexClass<C>>(
    indexCls: T
  ): InstanceType<T> {
    if (!this.#indexes.has(indexCls)) {
      this.#indexes.set(indexCls, new indexCls());
    }
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
    return this.#adaptersByIndex.get(indexCls)?.has(cls) ?? false;
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