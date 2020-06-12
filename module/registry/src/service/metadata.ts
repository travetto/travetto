import { Util } from '@travetto/base';

import { Registry } from '../registry';
import { Class, ChangeEvent } from '../types';

function id(cls: string | Class): string {
  return cls && typeof cls !== 'string' ? cls.ᚕid : cls;
}

/**
 * Metadata registry
 */
export abstract class MetadataRegistry<C extends { class: Class }, M = any, F = Function> extends Registry {

  static id = id;

  protected expired = new Map<string, C>();
  protected pending = new Map<string, Partial<C>>();
  protected pendingFields = new Map<string, Map<F, Partial<M>>>();

  protected entries = new Map<string, C>();

  abstract onInstallFinalize<T>(cls: Class<T>): C;

  onUninstallFinalize<T>(cls: Class<T>) {

  }

  abstract createPending(cls: Class): Partial<C>;

  has(cls: string | Class) {
    return this.entries.has(id(cls));
  }

  get(cls: string | Class): C {
    return this.entries.get(id(cls))!;
  }

  getExpired(cls: string | Class): C {
    return this.expired.get(id(cls))!;
  }

  hasExpired(cls: string | Class) {
    return this.expired.has(id(cls));
  }

  hasPending(cls: string | Class) {
    return this.pending.has(id(cls));
  }

  getClasses() {
    return Array.from(this.entries.values()).map(x => x.class);
  }

  initialInstall(): any {
    return Array.from(this.pending.values()).map(x => x.class);
  }

  createPendingField(cls: Class, field: F): Partial<M> {
    return {};
  }

  getParentClass(cls: Class): Class | null {
    const parent = Object.getPrototypeOf(cls) as Class;
    return parent.name && parent !== Object ? parent : null;
  }

  getOrCreatePending(cls: Class): Partial<C> {
    const cid = id(cls);
    if (!this.pending.has(cid)) {
      this.pending.set(cid, this.createPending(cls));
      this.pendingFields.set(cid, new Map());
    }
    return this.pending.get(cid)!;
  }

  getOrCreatePendingField(cls: Class, field: F): Partial<M> {
    this.getOrCreatePending(cls);

    if (!this.pendingFields.get(cls.ᚕid)!.has(field)) {
      this.pendingFields.get(cls.ᚕid)!.set(field, this.createPendingField(cls, field));
    }
    return this.pendingFields.get(cls.ᚕid)!.get(field)!;
  }

  register(cls: Class, pconfig: Partial<C>) {
    const conf = this.getOrCreatePending(cls);
    Util.deepAssign(conf, pconfig);
  }

  registerField(cls: Class, field: F, pconfig: Partial<M>) {
    const conf = this.getOrCreatePendingField(cls, field);
    Util.deepAssign(conf, pconfig);
  }

  onInstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.pending.has(cls.ᚕid) || this.pendingFields.has(cls.ᚕid)) {
      console.debug(this.constructor.name, 'Installing', cls.ᚕid);
      const result = this.onInstallFinalize(cls);
      this.pendingFields.delete(cls.ᚕid);
      this.pending.delete(cls.ᚕid);

      this.entries.set(cls.ᚕid, result);
      this.emit(e);
    }
  }

  onUninstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.entries.has(cls.ᚕid)) {
      console.debug(this.constructor.name, 'Uninstalling', cls.ᚕid);
      this.expired.set(cls.ᚕid, this.entries.get(cls.ᚕid)!);
      this.entries.delete(cls.ᚕid);
      this.onUninstallFinalize(cls);
      if (e.type === 'removing') {
        this.emit(e);
      }
      process.nextTick(() => this.expired.delete(cls.ᚕid));
    }
  }

  onReset() {
    this.entries.clear();
    this.pending.clear();
    this.pendingFields.clear();
    this.expired.clear();
  }
}