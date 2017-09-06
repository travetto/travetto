import { Request, Response, NextFunction } from 'express';
import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable, Method, ControllerConfig } from '../model';
import { toPromise } from '@encore/base';
import { ExpressApp } from './app';
import { Class, DependencyRegistry } from '@encore/di';
import { EventEmitter } from 'events';

export class ControllerRegistry {

  private static pendingHandlers = new Map<string, Partial<RequestHandler>[]>();
  private static pendingHandlerMap = new Map<string, Map<Function, Partial<RequestHandler>>>();
  public static controllers = new Map<string, ControllerConfig>();
  private static events = new EventEmitter();

  static getControllerFilters(target: Object) {
    return ((target as any).filters || []) as Filter[];
  }

  static registerControllerFilter(target: Object, fn: Filter) {
    (target as any).filters = ((target as any).filters || []);
    (target as any).filters.push(fn);
  }


  static finalizeClass(config: Partial<ControllerConfig> & { class: Class, path: string }) {
    let final = config as ControllerConfig;
    final.filters = this.getControllerFilters(config.class);
    final.handlers = this.pendingHandlers.get(config.class.__id!)! as RequestHandler[];

    let id = config.class.__id!;
    this.pendingHandlers.delete(id);
    this.pendingHandlerMap.delete(id);
    if (this.controllers.has(config.path)) {
      console.log('Reloading controller', config.class.name, config.path);
    }
    this.controllers.set(config.path, final);
    process.nextTick(() => {
      this.events.emit('reload', config)
    });
  }

  static getOrCreateRequestHandlerConfig(cls: Class, handler: Filter) {
    let id = cls.__id!;

    if (!this.pendingHandlers.has(id)) {
      this.pendingHandlers.set(id, []);
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
      this.pendingHandlers.get(id)!.push(rh);
    }
    return this.pendingHandlerMap.get(id)!.get(handler)!;
  }

  static registerPendingRequestHandlder(config: Partial<RequestHandler>) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
      rh.method = config.method;
      rh.path = config.path;
      rh.headers = Object.assign(rh.headers, config.headers || {});
      return descriptor;
    };
  }

  static filterAdder(fn: Filter) {
    return (target: Object, propertyKey?: string, descriptor?: TypedPropertyDescriptor<any>) => {
      if (propertyKey && descriptor) {
        let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
        rh.filters!.unshift(fn);
        return descriptor;
      } else { // Class filters
        this.registerControllerFilter(target, fn);
      }
    };
  }


  static on(event: 'reload', callback: (result: ControllerConfig) => any): void;
  static on<T>(event: string, callback: (result: T) => any): void {
    this.events.on(event, callback);
  }
}