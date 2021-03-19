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
  protected resolved: boolean;
  /**
   * Initializing promises
   */
  protected initialized?: Promise<unknown>;
  /**
   * Event emitter, to broadcast event changes
   */
  protected emitter = new EventEmitter();
  /**
   * Dependent registries
   */
  protected dependents: Registry[] = [];
  /**
   * Parent registries
   */
  protected parents: ChangeSource<Class>[] = [];
  /**
   * Unique identifier
   */
  protected _uid: string;

  /**
   * Creates a new registry, with it's parents specified
   */
  constructor(...parents: ChangeSource<Class>[]) {
    this._uid = `${this.constructor.name}_${Date.now()}`;
    this.parents = parents;

    if (this.parents.length) {
      // Have the child listen to the parents
      for (const parent of this.parents) {
        this.listen(parent);
        if (parent instanceof Registry) {
          parent.dependents.push(this);
        }
      }
    }
  }

  /**
   * Run initialization
   */
  protected async runInit(): Promise<void> {
    try {
      this.resolved = false;
      console.debug('Initializing', { id: this.constructor.ᚕid, uid: this._uid });

      // Handle top level when dealing with non-registry
      const waitFor = this.parents.filter(x => !(x instanceof Registry));
      await Promise.all(waitFor.map(x => x.init()));

      const classes = await this.initialInstall();
      if (classes) {
        for (const cls of classes) {
          this.install(cls, { type: 'added', curr: cls });
        }
      }

      await Promise.all(this.dependents.map(x => x.init()));

      console.debug('Initialized', { id: this.constructor.ᚕid, uid: this._uid });
    } finally {
      this.resolved = true;
    }
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
  verifyInitialized() {
    if (!this.resolved) {
      throw new Error(`${this.constructor.name} has not been initialized, you probably need to call RootRegistry.init()`);
    }
  }

  /**
   * Initialize, with a built-in latch to prevent concurrent initializations
   */
  async init(): Promise<unknown> {
    console.debug('Trying to initialize', { id: this.constructor.ᚕid, uid: this._uid, initialized: !!this.initialized });

    if (!this.initialized) {
      this.initialized = this.runInit();
    }
    return this.initialized;
  }

  /**
   * When an installation event occurs
   */
  onInstall(cls: Class, e: ChangeEvent<Class>): void {

  }

  /**
   * When an un-installation event occurs
   */
  onUninstall(cls: Class, e: ChangeEvent<Class>): void {

  }

  /**
   * Uninstall a class or list of classes
   */
  uninstall(classes: Class | Class[], e: ChangeEvent<Class>) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onUninstall(cls, e);
    }
  }

  /**
   * Install a class or a list of classes
   */
  install(classes: Class | Class[], e: ChangeEvent<Class>) {
    if (!Array.isArray(classes)) {
      classes = [classes];
    }
    for (const cls of classes) {
      this.onInstall(cls, e);
    }
  }

  /**
   * Listen for events from the parent
   */
  onEvent(event: ChangeEvent<Class>) {
    console.debug('Received', { id: this.constructor.ᚕid, type: event.type, targetId: (event.curr ?? event.prev)!.ᚕid });

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
  emit(e: ChangeEvent<Class>) {
    console.log('Emitting', this.constructor.name, e);
    this.emitter.emit('change', e);
  }

  /**
   * Register additional listeners
   */
  on<T>(callback: ChangeHandler<Class<T>>): void {
    this.emitter.on('change', callback);
  }

  /**
   * Remove listeners
   */
  off<T>(callback: ChangeHandler<Class<T>>) {
    this.emitter.off('change', callback);
  }

  /**
   * Connect changes sources
   */
  listen(source: ChangeSource<Class>) {
    source.on(e => this.onEvent(e));
  }

  /**
   * On registry reset
   */
  onReset() { }

  /**
   * Reset entire registry
   */
  reset() {
    this.onReset();
    for (const des of this.dependents) {
      des.reset();
    }
    delete this.initialized;
  }
}