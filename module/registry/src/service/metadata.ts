/* eslint @typescript-eslint/no-unused-vars: ["error", { "args": "none"} ] */
import { Class } from '@travetto/runtime';

import { Registry } from '../registry.ts';
import { ChangeEvent } from '../types.ts';

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
    return Array.from(this.pending.values()).map(x => x.class).filter(x => !!x);
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
}