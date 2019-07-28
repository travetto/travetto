import { DependencyRegistry } from '@travetto/di';
import { MetadataRegistry, Class } from '@travetto/registry';

import { EndpointConfig, ControllerConfig, EndpointDecorator, ControllerDecorator } from './types';
import { Filter, RouteHandler, ParamConfig } from '../types';

class $ControllerRegistry extends MetadataRegistry<ControllerConfig, EndpointConfig> {

  constructor() {
    super(DependencyRegistry);
  }

  createPending(cls: Class) {
    return {
      class: cls,
      filters: [],
      headers: {},
      basePath: '',
      endpoints: [],
    };
  }

  createPendingField(cls: Class, handler: RouteHandler) {
    const controllerConf = this.getOrCreatePending(cls);

    const fieldConf = {
      id: '',
      path: '/',
      method: 'all',
      class: cls,
      filters: [],
      priority: controllerConf.endpoints!.length, // Lowest is first
      headers: {},
      params: [],
      handlerName: handler.name,
      handler
    } as EndpointConfig;

    controllerConf.endpoints!.push(fieldConf);

    return fieldConf;
  }

  getOrCreateEndpointConfig(cls: Class, handler: RouteHandler) {
    const fieldConf = this.getOrCreatePendingField(cls, handler) as EndpointConfig;
    return fieldConf;
  }

  registerControllerFilter(target: Class, fn: Filter) {
    const config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  registerEndpointFilter(target: Class, handler: RouteHandler, fn: Filter) {
    const config = this.getOrCreateEndpointConfig(target, handler);
    config.filters!.unshift(fn);
  }

  registerEndpointParameter(target: Class, handler: RouteHandler, param: ParamConfig, index: number) {
    const config = this.getOrCreateEndpointConfig(target, handler);
    if (index >= config.params.length) {
      config.params.length = index + 1;
    }
    config.params[index] = param;
  }

  createFilterDecorator(fn: Filter) {
    return ((target: any, prop: string, descriptor: TypedPropertyDescriptor<RouteHandler>) => {
      if (prop) {
        this.registerEndpointFilter(target.constructor, descriptor.value!, fn);
      } else {
        this.registerControllerFilter(target, fn);
      }
    }) as (ControllerDecorator & EndpointDecorator);
  }

  mergeDescribable(src: Partial<ControllerConfig | EndpointConfig>, dest: Partial<ControllerConfig | EndpointConfig>) {
    dest.headers = { ...dest.headers!, ...(src.headers || {}) };
    dest.filters = [...(dest.filters || []), ...(src.filters || [])];
    dest.title = src.title || dest.title;
    dest.description = src.description || dest.description;
  }

  registerPendingEndpoint(target: Class, descriptor: TypedPropertyDescriptor<RouteHandler>, config: Partial<EndpointConfig>) {
    const srcConf = this.getOrCreateEndpointConfig(target, descriptor.value!);
    srcConf.method = config.method || srcConf.method;
    srcConf.path = config.path || srcConf.path;
    srcConf.responseType = config.responseType || srcConf.responseType;
    srcConf.requestType = config.requestType || srcConf.requestType;
    srcConf.params = (config.params || srcConf.params).map(x => ({ ...x }));

    // Ensure path starts with '/'
    const p = srcConf.path;
    if (typeof p === 'string' && !p.startsWith('/')) {
      srcConf.path = `/${p}`;
    } else if (p instanceof RegExp && !p.source.startsWith('/')) {
      srcConf.path = new RegExp(`/${p.source}`, p.flags);
    }

    this.mergeDescribable(config, srcConf);

    return descriptor;
  }

  registerPending(target: Class, config: Partial<ControllerConfig>) {
    const srcConf = this.getOrCreatePending(target);
    srcConf.basePath = config.basePath || srcConf.basePath;

    if (!srcConf.basePath!.startsWith('/')) {
      srcConf.basePath = `/${srcConf.basePath}`;
    }

    this.mergeDescribable(config, srcConf);
  }

  onInstallFinalize(cls: Class) {
    const final = this.getOrCreatePending(cls) as ControllerConfig;

    // Handle duplicates, take latest
    const foundRoutes = new Set<string>();

    final.endpoints = final.endpoints
      .sort((a, b) => a.priority - b.priority)
      .map(ep => {
        ep.id = `${ep.method}#${final.basePath}${typeof ep.path === 'string' ? ep.path : ep.path.source}`;
        return ep;
      })
      .filter(ep => !foundRoutes.has(ep.id) && !!(foundRoutes.add(ep.id)));

    if (this.has(final.basePath)) {
      console.debug('Reloading controller', cls.name, final.basePath);
    }

    return final;
  }
}

export const ControllerRegistry = new $ControllerRegistry();