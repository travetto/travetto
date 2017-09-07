import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangedEvent } from './class-source';
import { Class } from '../model';
import * as _ from 'lodash';

export abstract class MetadataRegistry<C, M = any> extends Registry {

  private pendingClasses = new Map<string, Partial<C>>();
  private pendingMethods = new Map<string, Map<string, Partial<M>>>();
  private finalClasses = new Map<string, C>();

  abstract onFinalize(cls: Class, clsConfig: Partial<C>, methodConfigs?: Map<string, Partial<M>>): C;

  abstract onNewClassConfig(cls: Class): Partial<C>;

  onNewMethodConfig(cls: Class, method: Function): Partial<M> {
    return {}
  }

  getOrCreateClassConfig(cls: Class): Partial<C> {
    if (!this.pendingClasses.has(cls.__id)) {
      this.pendingClasses.set(cls.__id, this.onNewClassConfig(cls));
      this.pendingMethods.set(cls.__id, new Map());
    }
    return this.pendingClasses.get(cls.__id)!;
  }

  getOrCreateMethodConfig(cls: Class, method: Function): Partial<M> {
    this.getOrCreateClassConfig(cls);

    if (!this.pendingMethods.get(cls.__id)!.has(method.name)) {
      this.pendingMethods.get(cls.__id)!.set(method.name, this.onNewMethodConfig(cls, method));
    }
    return this.pendingMethods.get(cls.__id)!.get(method.name)!;
  }


  registerClass(cls: Class, pconfig: Partial<C>) {
    let conf = this.getOrCreateClassConfig(cls);
    _.merge(conf, pconfig);
  }

  registerMethod(cls: Class, method: Function, pconfig: Partial<M>) {
    let conf = this.getOrCreateMethodConfig(cls, method);
    _.merge(conf, pconfig);
  }

  finalizeClass(cls: Class) {
    let result = this.onFinalize(cls, this.getOrCreateClassConfig(cls), this.pendingMethods.get(cls.__id)!);
    this.pendingMethods.delete(cls.__id);
    this.pendingClasses.delete(cls.__id);
    this.finalClasses.set(cls.__id, result);
  }

  onEvent(e: ChangedEvent) {
    let ret = super.onEvent(e);
    return ret;
  }
}