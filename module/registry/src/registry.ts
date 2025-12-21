import { AppError, castTo, Class, Env, flushPendingFunctions, isClass, Runtime, RuntimeIndex, Util } from '@travetto/runtime';

import { RegistryIndex, RegistryIndexClass } from './types';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  #uniqueId = Util.uuid();

  // Lookups
  #indexByClass = new Map<RegistryIndexClass, RegistryIndex>();

  // Eventing
  #indexes: RegistryIndex[] = [];

  #finalizeItems(classes: Class[]): void {
    for (const index of this.#indexes) {
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

  /**
   * Process change events
   */
  process(classes: Class[]): void {
    this.#finalizeItems(classes);

    const byIndex = new Map<RegistryIndex, Class[]>();
    for (const index of this.#indexes) {
      byIndex.set(index, classes.filter(cls => index.store.has(cls)));
    }

    for (const index of this.#indexes) {
      for (const cls of byIndex.get(index)!) {
        index.onCreate?.(cls);
      }
      index.beforeChangeSetComplete?.(byIndex.get(index)!);
    }

    // Call after everything is done
    for (const index of this.#indexes) {
      index.onChangeSetComplete?.(byIndex.get(index)!);
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

      // Ensure everything is loaded
      for (const entry of RuntimeIndex.find({
        module: (mod) => {
          const role = Env.TRV_ROLE.value;
          return role !== 'test' && // Skip all modules when in test
            mod.roles.includes('std') &&
            (
              !Runtime.production || mod.prod ||
              (role === 'doc' && mod.roles.includes(role))
            );
        },
        folder: folder => folder === 'src' || folder === '$index'
      })) {
        await Runtime.importFrom(entry.import);
      }

      // Flush all load events
      const added = flushPendingFunctions().filter(isClass);
      this.process(added);
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
      this.#indexes.push(instance);
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
}

export const Registry = new $Registry();