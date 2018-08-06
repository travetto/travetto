import { DependencyRegistry } from '@travetto/di';
import { MetadataRegistry, Class } from '@travetto/registry';

import { EndpointConfig, Filter, ControllerConfig } from '../types';

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

  createPendingField(cls: Class, handler: Filter) {
    const controllerConf = this.getOrCreatePending(cls);

    const fieldConf = {
      id: '',
      path: '/',
      method: 'all',
      class: cls,
      filters: [],
      headers: {},
      params: {},
      handlerName: handler.name,
      handler
    } as EndpointConfig;

    controllerConf.endpoints!.push(fieldConf);

    return fieldConf;
  }

  getOrCreateEndpointConfig(cls: Class, handler: Filter) {
    const fieldConf = this.getOrCreatePendingField(cls, handler) as EndpointConfig;
    return fieldConf;
  }

  registerControllerFilter(target: Class, fn: Filter) {
    const config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  registerEndpointFilter(target: Class, handler: Filter, fn: Filter) {
    const config = this.getOrCreateEndpointConfig(target, handler);
    config.filters!.unshift(fn);
  }

  mergeDescribable(src: Partial<ControllerConfig | EndpointConfig>, dest: Partial<ControllerConfig | EndpointConfig>) {
    dest.headers = { ...dest.headers!, ...(src.headers || {}) };
    dest.filters = [...(dest.filters || []), ...(src.filters || [])];
    dest.title = src.title || dest.title;
    dest.description = src.description || dest.description;
  }

  registerPendingEndpoint(target: Class, descriptor: TypedPropertyDescriptor<any>, config: Partial<EndpointConfig>) {
    const srcConf = this.getOrCreateEndpointConfig(target, descriptor.value);
    srcConf.method = config.method || srcConf.method;
    srcConf.path = config.path || srcConf.path;
    srcConf.responseType = config.responseType || srcConf.responseType;
    srcConf.requestType = config.requestType || srcConf.requestType;

    if (config.params) {
      for (const p of Object.values(config.params)) {
        srcConf.params[p.name] = { ...(srcConf.params[p.name] || {}), ...p };
      }
    }

    this.mergeDescribable(config, srcConf);
    return descriptor;
  }

  registerPending(target: Class, config: Partial<ControllerConfig>) {
    const srcConf = this.getOrCreatePending(target);
    srcConf.basePath = config.basePath || srcConf.basePath;
    this.mergeDescribable(config, srcConf);
  }

  onInstallFinalize(cls: Class) {
    const final = this.getOrCreatePending(cls) as ControllerConfig;

    // Handle duplicates, take latest
    const found = new Map<string, EndpointConfig>();
    for (const ep of final.endpoints) {
      ep.id = `${ep.method}#${final.basePath}/${ep.path === undefined ? '' : (typeof ep.path === 'string' ? ep.path : ep.path.source)}`;
      found.set(ep.id, ep);
    }
    final.endpoints = Array.from(found.values());

    if (this.has(final.basePath)) {
      console.debug('Reloading controller', cls.name, final.basePath);
    }

    return final;
  }
}

export const ControllerRegistry = new $ControllerRegistry();