import { AppError, castTo, Class, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { ChangeEvent } from '../types';
import { MethodSource } from '../source/method-source';
import { RegistryIndex, RegistryIndexClass, EXPIRED_CLASS, RegistryChangeListener } from './types';

type EventHandler = { index: RegistryIndex, handler: RegistryChangeListener<Class> };

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  #uniqueId = Util.uuid();

  // Lookups
  #indexByClass = new Map<RegistryIndexClass, RegistryIndex>();

  // Eventing
  #classSource = new ClassSource();
  #methodSource?: MethodSource;
  #indexHandlers: EventHandler[] = [];
  #listeners: EventHandler[] = [];

  #removeItems(classes: Class[]): void {
    for (const cls of classes) {
      for (const { index } of this.#indexHandlers) {
        index.store.remove(cls);
      }
      // Tag expired classes
      Object.assign(cls, { [EXPIRED_CLASS]: true });
    }
  }

  #finalizeItems(classes: Class[]): void {
    for (const { index } of this.#indexHandlers) {
      for (const cls of classes) {
        if (index.store.has(cls) && !index.store.finalized(cls)) {
          if (index.finalize) {
            index.finalize(cls);
          } else {
            index.store.finalize(cls);
          }
        }
      }
    }
  }

  trace = false;

  validateConstructor(source: unknown): void {
    if (source !== this) {
      throw new AppError('constructor is private');
    }
  }

  finalizeForIndex(indexCls: RegistryIndexClass): void {
    const inst = this.instance(indexCls);
    this.#finalizeItems(inst.store.getClasses());
  }

  process(events: ChangeEvent<Class>[]): void {
    this.#finalizeItems(events.filter(event => 'current' in event).map(event => event.current));

    const byIndex = new Map<RegistryIndex, ChangeEvent<Class>[]>();
    for (const { index } of this.#indexHandlers) {
      byIndex.set(index, events.filter(event => index.store.has('current' in event ? event.current : event.previous)));
    }

    for (const { index, handler } of [...this.#indexHandlers, ...this.#listeners]) {
      for (const event of byIndex.get(index)!) {
        if ('previous' in event) {
          handler.onRemoved?.(event.previous, 'current' in event ? event.current : undefined);
        }
        if ('current' in event) {
          handler.onAdded?.(event.current, 'previous' in event ? event.previous : undefined);
        }
      }
      handler.beforeChangeSetComplete?.(byIndex.get(index)!);
    }

    this.#removeItems(events.filter(event => 'previous' in event).map(event => event.previous!));

    // Call after everything is done
    for (const { index, handler } of [...this.#indexHandlers, ...this.#listeners]) {
      handler.onChangeSetComplete?.(byIndex.get(index)!);
    }
  }

  /**
   * Run initialization
   */
  async #init(): Promise<void> {
    try {
      this.#resolved = false;

      if (this.trace) {
        console.debug('Initializing', { uniqueId: this.#uniqueId });
      }

      const added = await this.#classSource.init();
      this.process(added.map(cls => ({ type: 'added', current: cls })));
      this.#classSource.on(event => this.process([event]));
    } finally {
      this.#resolved = true;
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
   * Register a new index
   */
  registerIndex<T extends RegistryIndexClass>(indexCls: T): InstanceType<T> {
    if (!this.#indexByClass.has(indexCls)) {
      const instance = new indexCls(this);
      this.#indexByClass.set(indexCls, instance);
      this.#indexHandlers.push({ index: instance, handler: instance });
    }
    return castTo(this.#indexByClass.get(indexCls));
  }

  /**
   * Initialize, with a built-in latch to prevent concurrent initializations
   */
  async init(): Promise<unknown> {
    if (this.trace && this.#initialized) {
      console.trace('Trying to re-initialize', { uniqueId: this.#uniqueId, initialized: !!this.#initialized });
    }
    return this.#initialized ??= this.#init();
  }

  instance<T extends RegistryIndexClass>(indexCls: T): InstanceType<T> {
    return castTo(this.#indexByClass.get(indexCls));
  }

  /**
   * Listen for changes
   */
  onClassChange(indexCls: RegistryIndexClass, listener: RegistryChangeListener<Class>): void {
    this.#listeners.push({ index: this.instance(indexCls), handler: listener });
  }

  onNonClassChanges(handler: (file: string) => void): void {
    this.#classSource.onNonClassChanges(handler);
  }

  onMethodChange(
    handler: (event: ChangeEvent<[Class, Function]>) => void,
    matches?: RegistryIndexClass,
  ): void {
    const emitter = this.#methodSource ??= new MethodSource(this.#classSource);
    if (!matches) {
      emitter.on(handler);
    } else {
      const inst = this.instance(matches);
      emitter.on((event) => {
        if (inst.store.has('current' in event ? event.current[0] : event.previous[0])) {
          handler(event);
        }
      });
    }
  }
}

export const Registry = new $Registry();