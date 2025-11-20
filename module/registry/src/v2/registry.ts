import { EventEmitter } from 'node:events';
import { AppError, castTo, Class, Util } from '@travetto/runtime';

import { ClassSource } from '../source/class-source';
import { ChangeEvent } from '../types';
import { MethodSource } from '../source/method-source';
import { RegistryIndex, RegistryIndexClass } from './types';

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
    }
  }

  #finalizeItems(classes: Class[]): void {
    for (const idx of this.#indexOrder) {
      const inst = this.instance(idx);
      for (const cls of classes) {
        inst.store.finalize(cls);
      }
    }
  }

  process(events: ChangeEvent<Class>[]): void {
    this.#finalizeItems(events.filter(ev => 'curr' in ev).map(ev => ev.curr));

    for (const indexCls of this.#indexOrder) { // Visit every index, in order
      const inst = this.instance(indexCls);
      const matched = events.filter(e => inst.store.has('curr' in e ? e.curr : e.prev!));
      if (matched.length) {
        inst.process(matched);
      }
    }

    for (const e of events) {
      this.#emitter.emit('event', e);
    }

    this.#removeItems(events.filter(ev => 'prev' in ev).map(ev => ev.prev));
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
      this.process(added.map(cls => ({ type: 'added', curr: cls })));
      this.#classSource.on(e => this.process([e]));
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
        if (inst.store.has('curr' in event ? event.curr : event.prev!)) {
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
        if (inst.store.has('curr' in event ? event.curr?.[0] : event.prev!?.[0])) {
          handler(event);
        }
      });
    }
  }
}

export const RegistryV2 = new $Registry();