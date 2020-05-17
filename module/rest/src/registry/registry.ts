import { DependencyRegistry } from '@travetto/di';
import { MetadataRegistry, Class } from '@travetto/registry';

import { EndpointConfig, ControllerConfig, EndpointDecorator, ControllerDecorator } from './types';
import { Filter, RouteHandler, ParamConfig } from '../types';

/**
 * Controller registery
 */
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

  /**
   * Register the endpoint config
   * @param cls Controller class
   * @param handler Route handler
   */
  getOrCreateEndpointConfig(cls: Class, handler: RouteHandler) {
    const fieldConf = this.getOrCreatePendingField(cls, handler) as EndpointConfig;
    return fieldConf;
  }

  /**
   * Regiseter the controller filter
   * @param cls Controller class
   * @param fn The filter to call
   */
  registerControllerFilter(target: Class, fn: Filter) {
    const config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  /**
   * Regiseter the controller filter
   * @param cls Controller class
   * @param handler Route handler
   * @param fn The filter to call
   */
  registerEndpointFilter(target: Class, handler: RouteHandler, fn: Filter) {
    const config = this.getOrCreateEndpointConfig(target, handler);
    config.filters!.unshift(fn);
  }

  /**
   * Regiseter the endpoing parameter
   * @param cls Controller class
   * @param handler Route handler
   * @param param The param config
   * @param index The parameter index
   */
  registerEndpointParameter(target: Class, handler: RouteHandler, param: ParamConfig, index: number) {
    const config = this.getOrCreateEndpointConfig(target, handler);
    if (index >= config.params.length) {
      config.params.length = index + 1;
    }
    config.params[index] = param;
  }

  /**
   * Create a filter decorator
   * @param fn The filter to call
   */
  createFilterDecorator(fn: Filter) {
    return ((target: any, prop: string, descriptor: TypedPropertyDescriptor<RouteHandler>) => {
      if (prop) {
        this.registerEndpointFilter(target.constructor, descriptor.value!, fn);
      } else {
        this.registerControllerFilter(target, fn);
      }
    }) as (ControllerDecorator & EndpointDecorator);
  }

  /**
   * Merge descriptions
   * @param src Root descriable (controller, endpoint)
   * @param dest Target (controller, endpoint)
   */
  mergeDescribable(src: Partial<ControllerConfig | EndpointConfig>, dest: Partial<ControllerConfig | EndpointConfig>) {
    dest.headers = { ...dest.headers!, ...(src.headers ?? {}) };
    dest.filters = [...(dest.filters ?? []), ...(src.filters ?? [])];
    dest.title = src.title || dest.title;
    dest.description = src.description || dest.description;
  }

  /**
   * Register an endpoint as pending
   * @param target Controller class
   * @param descriptor Prop descriptor
   * @param config The endpoint config
   */
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