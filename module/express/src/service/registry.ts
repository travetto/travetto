import { DependencyRegistry } from '@travetto/di';
import { MetadataRegistry, Class } from '@travetto/registry';

import {
  RequestHandler, Filter,
  ControllerConfig
} from '../model';

class $ControllerRegistry extends MetadataRegistry<ControllerConfig, RequestHandler> {

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
    const id = cls.__id!;
    const controllerConf = this.getOrCreatePending(cls);

    if (!this.pendingMethods.has(id)) {
      this.pendingMethods.set(id, new Map());
    }
    if (!this.pendingMethods.get(id)!.has(handler)) {
      const rh = {
        filters: [],
        class: cls,
        handler,
        headers: {}
      };
      this.pendingMethods.get(id)!.set(handler, rh);
      controllerConf.handlers!.push(rh);
    }
    return this.pendingMethods.get(id)!.get(handler)!;
  }

  registerControllerFilter(target: Class, fn: Filter) {
    const config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  registerRequestHandlerFilter(target: Class, handler: Filter, fn: Filter) {
    const rh = this.getOrCreateRequestHandlerConfig(target, handler);
    rh.filters!.unshift(fn);
  }

  registerPendingRequestHandler(config: Partial<RequestHandler>) {
    return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      const rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
      rh.method = config.method || rh.method;
      rh.path = config.path || rh.path;
      rh.headers = { ...rh.headers, ...(config.headers || {}) };
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

  onInstallFinalize(cls: Class) {
    const final = this.getOrCreatePending(cls) as ControllerConfig;

    // Handle duplicates, take latest
    const found = new Map<string, RequestHandler>();
    for (const h of final.handlers) {
      const key = `${h.method}#${h.path === undefined ? '' : (typeof h.path === 'string' ? h.path : h.path.source)}`;
      found.set(key, h);
    }
    final.handlers = Array.from(found.values());

    if (this.has(final.path)) {
      console.debug('Reloading controller', cls.name, final.path);
    }

    return final;
  }
}

export const ControllerRegistry = new $ControllerRegistry();