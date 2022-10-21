import { EventEmitter } from 'events';
import { Class } from '@travetto/base';
import { ChangeSource, ChangeEvent, ChangeHandler } from './types';

/**
 * Base registry class, designed to listen to changes over time
 */
export abstract class Registry implements ChangeSource<Class> {

  /**
   * Has the registry been resolved
   */
  #resolved: boolean;
  /**
   * Initializing promises
   */
  #initialized?: Promise<unknown>;
  /**
   * Event emitter, to broadcast event changes
   */
  #emitter = new EventEmitter();
  /**
   * Dependent registries
   */
  #dependents: Registry[] = [];
  /**
   * Parent registries
   */
  #parents: ChangeSource<Class>[] = [];
  /**
   * Unique identifier
   */
  #uid: string;

  /**
   * Creates a new registry, with it's parents specified
   */
  constructor(...parents: ChangeSource<Class>[]) {
    this.#uid = `${this.constructor.name}_${Date.now()}`;
    this.#parents = parents;

    if (this.#parents.length) {
      // Have the child listen to the parents
      for (const parent of this.#parents) {
        this.listen(parent);
        if (parent instanceof Registry) {
          parent.#dependents.push(this);
        }
      }
    }
  }

  /**
   * Reset parents
   */
  protected resetParents(): void {
    for (const parent of this.#parents) {
      parent.reset();
    }
  }

  /**
   * Run initialization
   */
  async #runInit(): Promise<void> {
    try {
      this.#resolved = false;
      console.debug('Initializing', { id: this.constructor.Ⲑid, uid: this.#uid });

      // Handle top level when dealing with non-registry
      const waitFor = this.#parents.filter(x => !(x instanceof Registry));
      await Promise.all(waitFor.map(x => x.init()));

      const classes = await this.initialInstall();
      if (classes) {
        for (const cls of classes) {
          this.install(cls, { type: 'added', curr: cls });
        }
      }

      await Promise.all(this.#dependents.map(x => x.init()));

      console.debug('Initialized', { id: this.constructor.Ⲑid, uid: this.#uid });
    } finally {
      this.#resolved = true;
    }
  }

  get resolved(): boolean {
    return this.#resolved;
  }

  /**
   * Return list of classes for the initial installation
   */
  initialInstall(): Class[] {
    return [];
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
    console.debug('Trying to initialize', { id: this.constructor.Ⲑid, uid: this.#uid, initialized: !!this.#initialized });

    if (!this.#initialized) {
      this.#initialized = this.#runInit();
    }
    return this.#initialized;
  }

  /**
   * When an installation event occurs
   */
  onInstall?(cls: Class, e: ChangeEvent<Class>): void;

  /**
   * When an un-installation event occurs
   */
  onUninstall?(cls: Class, e: ChangeEvent<Class>): void;

  /**
   * Uninstall a class or list of classes
   */
  uninstall(classes: Class | Class[], e: ChangeEvent<Class>): void {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onUninstall?.(cls, e);
    }
  }

  /**
   * Install a class or a list of classes
   */
  install(classes: Class | Class[], e: ChangeEvent<Class>): void {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onInstall?.(cls, e);
    }
  }

  /**
   * Listen for events from the parent
   */
  onEvent(event: ChangeEvent<Class>): void {
    console.debug('Received', { id: this.constructor.Ⲑid, type: event.type, targetId: (event.curr ?? event.prev)!.Ⲑid });

    switch (event.type) {
      case 'removing':
        this.uninstall(event.prev!, event);
        break;
      case 'added':
        this.install(event.curr!, event);
        break;
      case 'changed':
        this.uninstall(event.prev!, event);
        this.install(event.curr!, event);
        break;
      default:
        return;
    }
  }

  /**
   * Emit a new event
   */
  emit(e: ChangeEvent<Class>): void {
    this.#emitter.emit('change', e);
  }

  /**
   * Register additional listeners
   */
  on<T>(callback: ChangeHandler<Class<T>>): void {
    this.#emitter.on('change', callback);
  }

  /**
   * Remove listeners
   */
  off<T>(callback: ChangeHandler<Class<T>>): void {
    this.#emitter.off('change', callback);
  }

  /**
   * Connect changes sources
   */
  listen(source: ChangeSource<Class>): void {
    source.on(e => this.onEvent(e));
  }

  /**
   * On registry reset
   */
  onReset(): void {
    this.#resolved = false;
  }

  /**
   * Reset entire registry
   */
  reset(): void {
    this.onReset();
    for (const des of this.#dependents) {
      des.reset();
    }
    this.#initialized = undefined;
  }
}