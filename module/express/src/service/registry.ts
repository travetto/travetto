import { Request, Response, NextFunction } from 'express';
import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable, Method, ControllerConfig } from '../model';
import { toPromise, externalPromise } from '@encore2/base';
import { ExpressApp } from './app';
import { Class, DependencyRegistry } from '@encore2/di';
import { EventEmitter } from 'events';

export class ControllerRegistry {

  private static pendingControllers = new Map<string, Partial<ControllerConfig>>();
  private static pendingHandlerMap = new Map<string, Map<Function, Partial<RequestHandler>>>();
  public static controllers = new Map<string, ControllerConfig>();
  private static events = new EventEmitter();
  private static initalized = externalPromise();

  static getOrCreateControllerConfig(cls: Class) {
    let id = cls.__id!;

    if (!this.pendingControllers.has(id)) {
      this.pendingControllers.set(id, {
        filters: [],
        path: '',
        class: cls,
        handlers: []

      });
    }
    return this.pendingControllers.get(id)!;
  }

  static getOrCreateRequestHandlerConfig(cls: Class, handler: Filter) {
    let id = cls.__id!;
    let controllerConf = this.getOrCreateControllerConfig(cls);

    if (!this.pendingHandlerMap.has(id)) {
      this.pendingHandlerMap.set(id, new Map());
    }
    if (!this.pendingHandlerMap.get(id)!.has(handler)) {
      let rh = {
        filters: [],
        class: cls,
        handler: handler,
        headers: {}
      };
      this.pendingHandlerMap.get(id)!.set(handler, rh);
      controllerConf.handlers!.push(rh);
    }
    return this.pendingHandlerMap.get(id)!.get(handler)!;
  }

  static registerControllerFilter(target: Class, fn: Filter) {
    let config = this.getOrCreateControllerConfig(target);
    config.filters!.push(fn);
  }

  static registerRequestHandlerFilter(target: Class, handler: Filter, fn: Filter) {
    let rh = this.getOrCreateRequestHandlerConfig(target, handler);
    rh.filters!.unshift(fn);
  }

  static registerPendingRequestHandlder(config: Partial<RequestHandler>) {
    return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
      rh.method = config.method;
      rh.path = config.path;
      rh.headers = Object.assign(rh.headers, config.headers || {});
      return descriptor;
    };
  }

  static filterAdder(fn: Filter) {
    return (target: any, propertyKey?: string, descriptor?: TypedPropertyDescriptor<any>) => {
      if (propertyKey && descriptor) {
        this.registerRequestHandlerFilter(target.constructor as Class, descriptor.value, fn);
        return descriptor;
      } else { // Class filters
        this.registerControllerFilter(target, fn);
      }
    };
  }

  static registerClass(config: { class: Class, path: string }) {
    let conf = this.getOrCreateControllerConfig(config.class);
    conf.path = config.path;
    if (this.initalized.run()) {
      console.log('Live reload', config.class.__id)
      this.finalizeClass(config.class);
    }
  }

  static finalizeClass(cls: Class) {
    let id = cls.__id!;
    let final = this.pendingControllers.get(id)! as ControllerConfig;
    this.pendingHandlerMap.delete(id);
    this.pendingControllers.delete(id);

    if (this.controllers.has(final.path)) {
      console.log('Reloading controller', cls.name, final.path);
    }

    this.controllers.set(final.path, final);

    if (this.initalized.running !== false) {
      process.nextTick(() => {
        this.events.emit('reload', final)
      });
    }
  }

  static async initialize() {
    console.log(this.initalized);
    await DependencyRegistry.initialize();


    if (this.initalized.run()) {
      return await this.initalized;
    }


    for (let { class: cls } of this.pendingControllers.values()) {
      this.finalizeClass(cls!);
    }

    this.initalized.resolve(true);
  }

  static on(event: 'reload', callback: (result: ControllerConfig) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}