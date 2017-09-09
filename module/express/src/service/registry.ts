import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable, Method, ControllerConfig } from '../model';
import { toPromise, externalPromise } from '@encore2/base';
import { ExpressApp } from './app';
import { DependencyRegistry } from '@encore2/di';
import { MetadataRegistry, Class } from '@encore2/registry';

export class $ControllerRegistry extends MetadataRegistry<ControllerConfig, RequestHandler> {

  constructor() {
    super(DependencyRegistry);
  }

  createPending(cls: Class) {
    return {
      filters: [],
      path: '',
      class: cls,
      handlers: []
    };
  }

  getOrCreateRequestHandlerConfig(cls: Class, handler: Filter) {
    let id = cls.__id!;
    let controllerConf = this.getOrCreatePending(cls);

    if (!this.pendingMethods.has(id)) {
      this.pendingMethods.set(id, new Map());
    }
    if (!this.pendingMethods.get(id)!.has(handler)) {
      let rh = {
        filters: [],
        class: cls,
        handler: handler,
        headers: {}
      };
      this.pendingMethods.get(id)!.set(handler, rh);
      controllerConf.handlers!.push(rh);
    }
    return this.pendingMethods.get(id)!.get(handler)!;
  }

  registerControllerFilter(target: Class, fn: Filter) {
    let config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  registerRequestHandlerFilter(target: Class, handler: Filter, fn: Filter) {
    let rh = this.getOrCreateRequestHandlerConfig(target, handler);
    rh.filters!.unshift(fn);
  }

  registerPendingRequestHandlder(config: Partial<RequestHandler>) {
    return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
      rh.method = config.method;
      rh.path = config.path;
      rh.headers = Object.assign(rh.headers, config.headers || {});
      return descriptor;
    };
  }

  filterAdder(fn: Filter) {
    return (target: any, propertyKey?: string, descriptor?: TypedPropertyDescriptor<any>) => {
      if (propertyKey && descriptor) {
        this.registerRequestHandlerFilter(target.constructor as Class, descriptor.value, fn);
        return descriptor;
      } else { // Class filters
        this.registerControllerFilter(target, fn);
      }
    };
  }

  registerClass(cls: Class, config: { class: Class, path: string }) {
    let conf = this.getOrCreatePending(config.class);
    conf.path = config.path;
  }

  onInstallFinalize(cls: Class) {
    let id = cls.__id!;
    let final = this.getOrCreatePending(cls) as ControllerConfig;

    if (this.has(final.path)) {
      console.log('Reloading controller', cls.name, final.path);
    }

    return final;
  }
}

export const ControllerRegistry = new $ControllerRegistry();