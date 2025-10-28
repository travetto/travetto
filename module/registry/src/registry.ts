/* eslint @typescript-eslint/no-unused-vars: ["error", { "args": "none"} ] */

import { EventEmitter } from 'node:events';
import { castTo, Class, Env } from '@travetto/runtime';
import { ChangeSource, ChangeEvent, ChangeHandler } from './types.ts';

function id(cls: string | Class): string {
  return cls && typeof cls !== 'string' ? cls.Ⲑid : cls;
}

type EventListener = {
  init(): Promise<unknown>;
  onEvent(ev: ChangeEvent<unknown>): void;
};

/**
 * Base registry class, designed to listen to changes over time
 */
export abstract class Registry<C extends { class: Class }, M = unknown, F = Function> implements ChangeSource<Class> {

  static id = id;

  /**
   * Classes pending removal
   */
  expired = new Map<string, C>();
  /**
   * Classes pending creation
   */
  pending = new Map<string, Partial<C>>();
  /**
   * Fields pending creation
   */
  pendingFields = new Map<string, Map<F, Partial<M>>>();
  /**
   * Active items
   */
  entries = new Map<string, C>();

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
  #dependents: EventListener[] = [];
  /**
   * Parent registries
   */
  #parents: ChangeSource<Class>[] = [];
  /**
   * Unique identifier
   */
  #uid: string;

  /**
   * Are we in a mode that should have enhanced debug info
   */
  trace = Env.DEBUG.val?.includes('@travetto/registry');

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
   * Run initialization
   */
  async #runInit(): Promise<void> {
    try {
      this.#resolved = false;
      if (this.trace) {
        console.debug('Initializing', { id: this.constructor.Ⲑid, uid: this.#uid });
      }

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
    } finally {
      this.#resolved = true;
    }
  }

  get resolved(): boolean {
    return this.#resolved;
  }

  /**
   * Code to call when the installation is finalized
   */
  onInstallFinalize<T>(cls: Class<T>): C {
    return castTo(this.pending.get(cls.Ⲑid));
  };

  /**
   * Code to call when uninstall is finalized
   */
  onUninstallFinalize<T>(cls: Class<T>): void {

  }

  /**
   * Create a pending class.  Items are pending until the registry is activated
   */
  createPending(cls: Class): Partial<C> {
    return {};
  }

  /**
   * Is class found by id or by Class
   */
  has(cls: string | Class): boolean {
    return this.entries.has(id(cls));
  }

  /**
   * Get class by id or by Class
   */
  get(cls: string | Class): C {
    return this.entries.get(id(cls))!;
  }

  /**
   * Retrieve the class that is being removed
   */
  getExpired(cls: string | Class): C {
    return this.expired.get(id(cls))!;
  }

  /**
   * Is there a class that is expiring
   */
  hasExpired(cls: string | Class): boolean {
    return this.expired.has(id(cls));
  }

  /**
   * Is there a pending state for the class
   */
  hasPending(cls: string | Class): boolean {
    return this.pending.has(id(cls));
  }

  /**
   * Get list of all classes that have been registered
   */
  getClasses(): Class[] {
    return Array.from(this.entries.values()).map(x => x.class);
  }

  /**
   * Create a pending field
   */
  createPendingField(cls: Class, field: F): Partial<M> {
    return {};
  }

  /**
   * Find parent class for a given class object
   */
  getParentClass(cls: Class): Class | null {
    const parent: Class = Object.getPrototypeOf(cls);
    return parent.name && parent !== Object ? parent : null;
  }

  /**
   * Get or create a pending class
   */
  getOrCreatePending(cls: Class): Partial<C> {
    const cid = id(cls);
    if (!this.pending.has(cid)) {
      this.pending.set(cid, this.createPending(cls));
      this.pendingFields.set(cid, new Map());
    }
    return this.pending.get(cid)!;
  }

  /**
   * Get or create a pending field
   */
  getOrCreatePendingField(cls: Class, field: F): Partial<M> {
    this.getOrCreatePending(cls);
    const classId = cls.Ⲑid;

    if (!this.pendingFields.get(classId)!.has(field)) {
      this.pendingFields.get(classId)!.set(field, this.createPendingField(cls, field));
    }
    return this.pendingFields.get(classId)!.get(field)!;
  }

  /**
   * Register a pending class, with partial config to overlay
   */
  register(cls: Class, pConfig: Partial<C> = {}): void {
    const conf = this.getOrCreatePending(cls);
    Object.assign(conf, pConfig);
  }

  /**
   * Register a pending field, with partial config to overlay
   */
  registerField(cls: Class, field: F, pConfig: Partial<M>): void {
    const conf = this.getOrCreatePendingField(cls, field);
    Object.assign(conf, pConfig);
  }

  /**
   * On an install event, finalize
   */
  onInstall(cls: Class, e: ChangeEvent<Class>): void {
    const classId = cls.Ⲑid;
    if (this.pending.has(classId) || this.pendingFields.has(classId)) {
      if (this.trace) {
        console.debug('Installing', { service: this.constructor.name, id: classId });
      }
      const result = this.onInstallFinalize(cls);
      this.pendingFields.delete(classId);
      this.pending.delete(classId);

      this.entries.set(classId, result);
      this.emit(e);
    }
  }

  /**
   * On an uninstall event, remove
   */
  onUninstall(cls: Class, e: ChangeEvent<Class>): void {
    const classId = cls.Ⲑid;
    if (this.entries.has(classId)) {
      if (this.trace) {
        console.debug('Uninstalling', { service: this.constructor.name, id: classId });
      }
      this.expired.set(classId, this.entries.get(classId)!);
      this.entries.delete(classId);
      this.onUninstallFinalize(cls);
      if (e.type === 'removing') {
        this.emit(e);
      }
      process.nextTick(() => this.expired.delete(classId));
    }
  }

  /**
   * Return list of classes for the initial installation
   */
  initialInstall(): Class[] {
    return Array.from(this.pending.values()).map(x => x.class).filter(x => !!x);
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
      console.debug('Trying to initialize', { id: this.constructor.Ⲑid, uid: this.#uid, initialized: !!this.#initialized });
    }

    if (!this.#initialized) {
      this.#initialized = this.#runInit();
    }
    return this.#initialized;
  }

  parent<T extends ChangeSource<Class>>(type: Class<T>): T | undefined {
    return this.#parents.find((dep: unknown): dep is T => dep instanceof type);
  }

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
    if (this.trace) {
      // console.debug('Received', { id: this.constructor.Ⲑid, type: event.type, targetId: (event.curr ?? event.prev)!.Ⲑid });
    }

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
}