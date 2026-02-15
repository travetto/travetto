import { RuntimeError, castTo, type Class, Env, flushPendingFunctions, isClass, Runtime, RuntimeIndex } from '@travetto/runtime';

import type { RegistryIndex, RegistryIndexClass } from './types.ts';

class $Registry {

  #resolved = false;
  #initialized?: Promise<unknown>;
  #indexByClass = new Map<RegistryIndexClass, RegistryIndex>();
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
      throw new RuntimeError('constructor is private');
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
        console.debug('Initializing');
      }

      // Ensure everything is loaded
      for (const entry of RuntimeIndex.find({
        module: (module) => {
          const role = Env.TRV_ROLE.value;
          return role !== 'test' && // Skip all modules when in test
            module.roles.includes('std') &&
            (
              !Runtime.production || module.production ||
              (role === 'doc' && module.roles.includes(role))
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
      throw new RuntimeError('Registry not initialized, call init() first');
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
      console.trace('Trying to re-initialize', { initialized: !!this.#initialized });
    }
    return this.#initialized ??= this.#init();
  }

  /**
   * Manual init, not meant to be used directly
   * @private
   */
  async manualInit(files: string[]): Promise<Class[]> {
    for (const file of files) {
      await Runtime.importFrom(file);
    }
    const imported = flushPendingFunctions().filter(isClass);
    this.process(imported);
    return imported;
  }

  instance<T extends RegistryIndexClass>(indexCls: T): InstanceType<T> {
    return castTo(this.#indexByClass.get(indexCls));
  }
}

export const Registry = new $Registry();