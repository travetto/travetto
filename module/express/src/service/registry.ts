import { Request, Response, NextFunction } from 'express';
import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable, Method, ControllerConfig } from '../model';
import { toPromise, externalPromise } from '@encore2/base';
import { ExpressApp } from './app';
import { DependencyRegistry } from '@encore2/di';
import { EventEmitter } from 'events';
import { MetadataRegistry, Class } from '@encore2/registry';

export class $ControllerRegistry extends MetadataRegistry<ControllerConfig, RequestHandler> {

  constructor() {
    super(DependencyRegistry);
  }

  onNewClassConfig(cls: Class) {
    return {
      filters: [],
      path: '',
      class: cls,
      handlers: []
    };
  }

  getOrCreateRequestHandlerConfig(cls: Class, handler: Filter) {
    let id = cls.__id!;
    let controllerConf = this.getOrCreateClassConfig(cls);

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
    let config = this.getOrCreateClassConfig(target);
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
    let conf = this.getOrCreateClassConfig(config.class);
    conf.path = config.path;

    if (this.initialized.resolved) {
      console.log('Live reload', config.class.__id)
      this.install(config.class);
    }
  }

  onInstallFinalize(cls: Class) {
    let id = cls.__id!;
    let final = this.pendingClasses.get(id)! as ControllerConfig;

    if (this.classes.has(final.path)) {
      console.log('Reloading controller', cls.name, final.path);
    }

    // Delay 
    process.nextTick(() => {
      this.events.emit('change', { type: 'changed', curr: cls });
    });

    return final;
  }

  async initialInstall() {
    console.log(Array.from(this.pendingClasses.keys()));
    for (let { class: cls } of this.pendingClasses.values()) {
      this.install(cls!);
    }
  }
}

export const ControllerRegistry = new $ControllerRegistry();