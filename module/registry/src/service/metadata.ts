import { Registry } from './registry';
import { CompilerClassSource } from './compiler-source';
import { ChangedEvent } from './class-source';
import { Class } from '../model';
import * as _ from 'lodash';

export abstract class MetadataRegistry<C, M> extends Registry {

  private pendingClasses = new Map<string, Partial<C>>();
  private pendingMethods = new Map<string, Map<string, Partial<M>>>();
  private finalClasses = new Map<string, C>();

  abstract onNewClassConfig(): Partial<C>;
  abstract onNewMethodConfig(): Partial<M>;
  abstract onFinalize(cls: Class, clsConfig: Partial<C>, methodConfigs: Map<string, Partial<M>>): C;

  getOrCreateClassConfig(cls: Class): Partial<C> {
    if (!this.pendingClasses.has(cls.__id)) {
      this.pendingClasses.set(cls.__id, this.onNewClassConfig());
      this.pendingMethods.set(cls.__id, new Map());
    }
    return this.pendingClasses.get(cls.__id)!;
  }

  getOrCreateMethodConfig(cls: Class, fn: Function): Partial<M> {
    this.getOrCreateClassConfig(cls);

    if (!this.pendingMethods.get(cls.__id)!.has(fn.name)) {
      this.pendingMethods.get(cls.__id)!.set(fn.name, this.onNewMethodConfig());
    }
    return this.pendingMethods.get(cls.__id)!.get(fn.name)!;
  }


  registerClass(cls: Class, pconfig: Partial<C>) {
    let conf = this.getOrCreateClassConfig(cls);
    _.merge(conf, pconfig);
  }

  registerMethod(cls: Class, fn: Function, pconfig: Partial<M>) {
    let conf = this.getOrCreateMethodConfig(cls, fn);
    _.merge(conf, pconfig);
  }

  finalizeClass(cls: Class) {
    let result = this.onFinalize(cls, this.getOrCreateClassConfig(cls), this.pendingMethods.get(cls.__id)!);
    this.pendingMethods.delete(cls.__id);
    this.pendingClasses.delete(cls.__id);
    this.finalClasses.set(cls.__id, result);
  }

  onEvent(e: ChangedEvent) {
    console.log(e);
    return super.onEvent(e);
  }
}