import { EventEmitter } from 'node:events';
import { AppError, castTo, Class, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { ChangeEvent } from '../types';
import { MethodSource } from '../source/method-source';
import { RegistryIndex, RegistryIndexClass, EXPIRED_CLASS } from './types';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  trace = false;
  #uid = Util.uuid();

  // Lookups
  #indexes = new Map<RegistryIndexClass, RegistryIndex>();
  #indexOrder: RegistryIndexClass[] = [];

  // Eventing
  #classSource = new ClassSource();
  #methodSource?: MethodSource;
  #emitter = new EventEmitter<{ event: [ChangeEvent<Class>] }>();

  #removeItems(classes: Class[]): void {
    for (const cls of classes) {
      for (const idx of this.#indexOrder) {
        this.instance(idx).store.remove(cls);
      }
      // Tag expired classes
      Object.assign(cls, { [EXPIRED_CLASS]: true });
    }
  }

  #finalizeItems(classes: Class[]): void {
    for (const idx of this.#indexOrder) {
      const inst = this.instance(idx);
      for (const cls of classes) {
        if (inst.store.has(cls) && !inst.store.finalized(cls)) {
          if (inst.finalize) {
            inst.finalize(cls);
          } else {
            inst.store.finalize(cls);
          }
        }
      }
    }
  }

  finalizeForIndex(indexCls: RegistryIndexClass): void {
    const inst = this.instance(indexCls);
    this.#finalizeItems(inst.store.getClasses());
  }

  process(events: ChangeEvent<Class>[]): void {
    this.#finalizeItems(events.filter(event => 'current' in event).map(event => event.current));

    for (const indexCls of this.#indexOrder) { // Visit every index, in order
      const inst = this.instance(indexCls);
      const matched = events.filter(event => inst.store.has('current' in event ? event.current : event.previous!));
      if (matched.length) {
        inst.process(matched);
      }
    }

    Util.queueMacroTask().then(() => {
      this.#removeItems(events.filter(event => 'previous' in event).map(event => event.previous!));
    });

    for (const event of events) {
      this.#emitter.emit('event', event);
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
    if (!this.#indexes.has(indexCls)) {
      this.#indexes.set(indexCls, new indexCls());
      this.#indexOrder.push(indexCls);
    }
    return castTo(this.#indexes.get(indexCls));
  }

  /**
   * Initialize, with a built-in latch to prevent concurrent initializations
   */
  async init(): Promise<unknown> {
    if (this.trace && this.#initialized) {
      console.trace('Trying to re-initialize', { uid: this.#uid, initialized: !!this.#initialized });
    }
    return this.#initialized ??= this.#init();
  }

  instance<T extends RegistryIndexClass>(indexCls: T): InstanceType<T> {
    return castTo(this.#indexes.get(indexCls));
  }

  /**
   * Listen for changes
   */
  onClassChange(handler: (event: ChangeEvent<Class>) => void, matches?: RegistryIndexClass): void {
    if (!matches) {
      this.#emitter.on('event', handler);
    } else {
      const inst = this.instance(matches);
      this.#emitter.on('event', (event) => {
        if (inst.store.has('current' in event ? event.current : event.previous!)) {
          handler(event);
        }
      });
    }
  }

  onNonClassChanges(handler: (file: string) => void): void {
    this.#classSource.onNonClassChanges(handler);
  }

  onMethodChange(
    handler: (event: ChangeEvent<[Class, Function]>) => void,
    matches?: RegistryIndexClass,
  ): void {
    const src = this.#methodSource ??= new MethodSource(this.#classSource);
    if (!matches) {
      src.on(handler);
    } else {
      const inst = this.instance(matches);
      src.on((event) => {
        if (inst.store.has('current' in event ? event.current[0] : event.previous[0])) {
          handler(event);
        }
      });
    }
  }
}

export const Registry = new $Registry();