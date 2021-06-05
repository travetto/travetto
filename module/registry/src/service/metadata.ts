import { Class, Util } from '@travetto/base';

import { Registry } from '../registry';
import { ChangeEvent } from '../types';

function id(cls: string | Class): string {
  return cls && typeof cls !== 'string' ? cls.ᚕid : cls;
}

/**
 * Metadata registry
 */
export abstract class MetadataRegistry<C extends { class: Class }, M = unknown, F = Function> extends Registry {

  static id = id;

  /**
   * Classes pending removal
   */
  protected expired = new Map<string, C>();
  /**
   * Classes pending creation
   */
  protected pending = new Map<string, Partial<C>>();
  /**
   * Fields pending creation
   */
  protected pendingFields = new Map<string, Map<F, Partial<M>>>();
  /**
   * Active items
   */
  protected entries = new Map<string, C>();

  /**
   * Code to call when the installation is finalized
   */
  abstract onInstallFinalize<T>(cls: Class<T>): C;

  /**
   * Code to call when uninstallation is finalized
   */
  onUninstallFinalize<T>(cls: Class<T>) {

  }

  /**
   * Create a pending class.  Items are pending until the registry is activated
   */
  abstract createPending(cls: Class): Partial<C>;

  /**
   * Is class found by id or by Class
   */
  has(cls: string | Class) {
    return this.entries.has(id(cls));
  }

  /**
   * Get class by id or by Class
   */
  get(cls: string | Class): C {
    return this.entries.get(id(cls))!;
  }

  /**
   * Retrive the class that is being removed
   */
  getExpired(cls: string | Class): C {
    return this.expired.get(id(cls))!;
  }

  /**
   * Is there a class that is expiring
   */
  hasExpired(cls: string | Class) {
    return this.expired.has(id(cls));
  }

  /**
   * Is there a pending state for the class
   */
  hasPending(cls: string | Class) {
    return this.pending.has(id(cls));
  }

  /**
   * Get list of all classes that have been registered
   */
  getClasses() {
    return Array.from(this.entries.values()).map(x => x.class);
  }

  /**
   * Trigger initial install, moves pending to finalized (active)
   */
  override initialInstall(): Class[] {
    return Array.from(this.pending.values()).map(x => x.class as Class).filter(x => !!x);
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
    const parent = Object.getPrototypeOf(cls) as Class;
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

    if (!this.pendingFields.get(cls.ᚕid)!.has(field)) {
      this.pendingFields.get(cls.ᚕid)!.set(field, this.createPendingField(cls, field));
    }
    return this.pendingFields.get(cls.ᚕid)!.get(field)!;
  }

  /**
   * Register a pending class, with partial config to overlay
   */
  register(cls: Class, pconfig: Partial<C> = {}) {
    const conf = this.getOrCreatePending(cls);
    Util.deepAssign(conf, pconfig);
  }

  /**
   * Register a pending field, with partial config to overlay
   */
  registerField(cls: Class, field: F, pconfig: Partial<M>) {
    const conf = this.getOrCreatePendingField(cls, field);
    Util.deepAssign(conf, pconfig);
  }

  /**
   * On an install event, finalize
   */
  onInstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.pending.has(cls.ᚕid) || this.pendingFields.has(cls.ᚕid)) {
      console.debug('Installing', { service: this.constructor.name, id: cls.ᚕid });
      const result = this.onInstallFinalize(cls);
      this.pendingFields.delete(cls.ᚕid);
      this.pending.delete(cls.ᚕid);

      this.entries.set(cls.ᚕid, result);
      this.emit(e);
    }
  }

  /**
   * On an uninstall event, remove
   */
  onUninstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.entries.has(cls.ᚕid)) {
      console.debug('Uninstalling', { service: this.constructor.name, id: cls.ᚕid });
      this.expired.set(cls.ᚕid, this.entries.get(cls.ᚕid)!);
      this.entries.delete(cls.ᚕid);
      this.onUninstallFinalize(cls);
      if (e.type === 'removing') {
        this.emit(e);
      }
      process.nextTick(() => this.expired.delete(cls.ᚕid));
    }
  }

  /**
   * Clear all caches
   */
  override onReset() {
    super.onReset();
    this.entries.clear();
    this.pending.clear();
    this.pendingFields.clear();
    this.expired.clear();
  }
}