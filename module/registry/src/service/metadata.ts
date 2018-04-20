import { Registry } from './registry';
import { ChangeEvent } from '../source';
import { Class } from '../model';

function id(cls: string | Class) {
  return cls && typeof cls !== 'string' ? cls.__id : cls;
}

export function isPrimitive(el: any) {
  const type = typeof el;
  return (type === 'string' || type === 'boolean' || type === 'number' || el instanceof RegExp);
}

export function merge<T extends any, U extends any>(a: T, b: U): T & U {
  const isEmptyA = a === undefined || a === null;
  const isEmptyB = b === undefined || b === null;
  const isArrA = Array.isArray(a);
  const isArrB = Array.isArray(b);

  if (!isEmptyB) {
    if (isPrimitive(b)) {
      if (isEmptyA || isPrimitive(a)) {
        return b as (T & U);
      } else {
        throw new Error(`Cannot merge primitive ${b} with ${a}`);
      }
    } else if (isArrB) {
      const bArr = b as any as any[];
      if (a === undefined) {
        return bArr.slice(0) as any as T & U;
      } else if (isArrA) {
        const aArr = (a as any as any[]).slice(0);
        for (let i = 0; i < bArr.length; i++) {
          aArr[i] = merge(aArr[i], bArr[i]);
        }
        return aArr as any as T & U;
      } else {
        throw new Error(`Cannot merge ${a} with ${b}`);
      }
    } else {
      if (isEmptyA || isArrA || isPrimitive(a)) {
        throw new Error(`Cannot merge ${b} onto ${a}`);
      }
      for (const key of Object.keys(b)) {
        a[key] = merge(a[key], b[key]);
      }
      return a as (T & U);
    }
  }
  return a as (T & U);
}

export abstract class MetadataRegistry<C extends { class: Class }, M = any> extends Registry {

  protected expired = new Map<string, C>();
  protected pending = new Map<string, Partial<C>>();
  protected pendingMethods = new Map<string, Map<Function, Partial<M>>>();

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

  createPendingMethod(cls: Class, method: Function): Partial<M> {
    return {}
  }

  getOrCreatePending(cls: Class): Partial<C> {
    const cid = id(cls);
    if (!this.pending.has(cid)) {
      this.pending.set(cid, this.createPending(cls));
      this.pendingMethods.set(cid, new Map());
    }
    return this.pending.get(cid)!;
  }

  getOrCreatePendingMethod(cls: Class, method: Function): Partial<M> {
    this.getOrCreatePending(cls);

    if (!this.pendingMethods.get(cls.__id)!.has(method)) {
      this.pendingMethods.get(cls.__id)!.set(method, this.createPendingMethod(cls, method));
    }
    return this.pendingMethods.get(cls.__id)!.get(method)!;
  }

  register(cls: Class, pconfig: Partial<C>) {
    const conf = this.getOrCreatePending(cls);
    merge(conf, pconfig);
  }

  registerMethod(cls: Class, method: Function, pconfig: Partial<M>) {
    const conf = this.getOrCreatePendingMethod(cls, method);
    merge(conf, pconfig);
  }

  onInstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.pending.has(cls.__id) || this.pendingMethods.has(cls.__id)) {
      const result = this.onInstallFinalize(cls);
      this.pendingMethods.delete(cls.__id);
      this.pending.delete(cls.__id);

      this.entries.set(cls.__id, result);
      this.emit(e);
    }
  }

  onUninstall(cls: Class, e: ChangeEvent<Class>) {
    if (this.entries.has(cls.__id)) {
      this.expired.set(cls.__id, this.entries.get(cls.__id)!);
      this.entries.delete(cls.__id);
      this.onUninstallFinalize(cls);
      if (e.type === 'removing') {
        this.emit(e);
      }
      process.nextTick(() => this.expired.delete(cls.__id));
    }
  }

  onReset() {
    this.entries.clear();
    this.pending.clear();
    this.pendingMethods.clear();
    this.expired.clear();
  }
}