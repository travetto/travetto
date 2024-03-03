import { Class } from '@travetto/base';

import { Registry } from '../registry';
import { ChangeEvent } from '../types';

function id(cls: string | Class): string {
  return cls && typeof cls !== 'string' ? cls.Ⲑid : cls;
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
   * Code to call when uninstall is finalized
   */
  onUninstallFinalize<T>(cls: Class<T>): void {

  }

  /**
   * Create a pending class.  Items are pending until the registry is activated
   */
  abstract createPending(cls: Class): Partial<C>;

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
   * Trigger initial install, moves pending to finalized (active)
   */
  override initialInstall(): Class[] {
    return Array.from(this.pending.values()).map(x => x.class).filter((x): x is Class => !!x);
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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

    if (!this.pendingFields.get(cls.Ⲑid)!.has(field)) {
      this.pendingFields.get(cls.Ⲑid)!.set(field, this.createPendingField(cls, field));
    }
    return this.pendingFields.get(cls.Ⲑid)!.get(field)!;
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
    if (this.pending.has(cls.Ⲑid) || this.pendingFields.has(cls.Ⲑid)) {
      if (this.trace) {
        console.debug('Installing', { service: this.constructor.name, id: cls.Ⲑid });
      }
      const result = this.onInstallFinalize(cls);
      this.pendingFields.delete(cls.Ⲑid);
      this.pending.delete(cls.Ⲑid);

      this.entries.set(cls.Ⲑid, result);
      this.emit(e);
    }
  }

  /**
   * On an uninstall event, remove
   */
  onUninstall(cls: Class, e: ChangeEvent<Class>): void {
    if (this.entries.has(cls.Ⲑid)) {
      if (this.trace) {
        console.debug('Uninstalling', { service: this.constructor.name, id: cls.Ⲑid });
      }
      this.expired.set(cls.Ⲑid, this.entries.get(cls.Ⲑid)!);
      this.entries.delete(cls.Ⲑid);
      this.onUninstallFinalize(cls);
      if (e.type === 'removing') {
        this.emit(e);
      }
      process.nextTick(() => this.expired.delete(cls.Ⲑid));
    }
  }
}