import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangeEvent } from './class-source';
import { Class } from '../model';
import * as _ from 'lodash';

export abstract class MetadataRegistry<C extends { class: Class }, M = any> extends Registry {

  protected pendingClasses = new Map<string, Partial<C>>();
  protected pendingMethods = new Map<string, Map<Function, Partial<M>>>();
  protected classes = new Map<string, C>();

  abstract onInstallFinalize<T>(cls: Class<T>): C;

  abstract createPending(cls: Class): Partial<C>;

  has(cls: string | Class) {
    if (typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.classes.has(cls);
  }

  get(cls: string | Class): C {
    if (cls && typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.classes.get(cls)!;
  }

  hasPending(cls: string | Class) {
    if (typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.pendingClasses.has(cls);
  }

  getClasses() {
    return Array.from(this.classes.values()).map(x => x.class);
  }

  initialInstall(): any {
    return this.getClasses();
  }

  createPendingMethod(cls: Class, method: Function): Partial<M> {
    return {}
  }

  getOrCreatePending(cls: Class): Partial<C> {
    if (!this.pendingClasses.has(cls.__id)) {
      this.pendingClasses.set(cls.__id, this.createPending(cls));
      this.pendingMethods.set(cls.__id, new Map());
    }
    return this.pendingClasses.get(cls.__id)!;
  }

  getOrCreatePendingMethod(cls: Class, method: Function): Partial<M> {
    this.getOrCreatePending(cls);

    if (!this.pendingMethods.get(cls.__id)!.has(method)) {
      this.pendingMethods.get(cls.__id)!.set(method, this.createPendingMethod(cls, method));
    }
    return this.pendingMethods.get(cls.__id)!.get(method)!;
  }


  register(cls: Class, pconfig: Partial<C>) {
    let conf = this.getOrCreatePending(cls);
    _.merge(conf, pconfig);
  }

  registerMethod(cls: Class, method: Function, pconfig: Partial<M>) {
    let conf = this.getOrCreatePendingMethod(cls, method);
    _.merge(conf, pconfig);
  }

  async onInstall(cls: Class, e: ChangeEvent) {
    if (this.pendingClasses.has(cls.__id) || this.pendingMethods.has(cls.__id)) {
      let result = this.onInstallFinalize(cls);
      this.pendingMethods.delete(cls.__id);
      this.pendingClasses.delete(cls.__id);
      this.classes.set(cls.__id, result);
      this.emit(e);
    }
  }

  async onUninstall(cls: Class, e: ChangeEvent) {
    if (this.classes.has(cls.__id)) {
      if (e.type === 'removing') {
        this.emit(e);
      }
      this.classes.delete(cls.__id);
    }
  }
}