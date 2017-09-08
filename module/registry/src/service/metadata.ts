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

  abstract onNewClassConfig(cls: Class): Partial<C>;

  hasClass(cls: string | Class) {
    if (typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.classes.has(cls);
  }

  getClass(cls: string | Class): C {
    if (cls && typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.classes.get(cls)!;
  }

  hasPendingClass(cls: string | Class) {
    if (typeof cls !== 'string') {
      cls = cls.__id;
    }
    return this.pendingClasses.has(cls);
  }

  getRawClasses() {
    return Array.from(this.classes.values()).map(x => x.class);
  }

  initialInstall(): any {
    return this.getRawClasses();
  }

  onNewMethodConfig(cls: Class, method: Function): Partial<M> {
    return {}
  }

  getOrCreatePendingClass(cls: Class): Partial<C> {
    if (!this.pendingClasses.has(cls.__id)) {
      this.pendingClasses.set(cls.__id, this.onNewClassConfig(cls));
      this.pendingMethods.set(cls.__id, new Map());
    }
    return this.pendingClasses.get(cls.__id)!;
  }

  getOrCreatePendingMethod(cls: Class, method: Function): Partial<M> {
    this.getOrCreatePendingClass(cls);

    if (!this.pendingMethods.get(cls.__id)!.has(method)) {
      this.pendingMethods.get(cls.__id)!.set(method, this.onNewMethodConfig(cls, method));
    }
    return this.pendingMethods.get(cls.__id)!.get(method)!;
  }


  registerClass(cls: Class, pconfig: Partial<C>) {
    let conf = this.getOrCreatePendingClass(cls);
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