import { DependencyRegistry } from '@travetto/di';
import { type Primitive, type Class, asFull, castTo, asConstructable } from '@travetto/runtime';
import { MetadataRegistry } from '@travetto/registry';

import { EndpointConfig, ControllerConfig, EndpointDecorator } from './types.ts';
import { Filter, RouteHandler, ParamConfig } from '../types.ts';
import { RestInterceptor } from '../interceptor/types.ts';

type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

/**
 * Controller registry
 */
class $ControllerRegistry extends MetadataRegistry<ControllerConfig, EndpointConfig> {

  #endpointsById = new Map<string, EndpointConfig>();

  constructor() {
    super(DependencyRegistry);
  }

  getEndpointByNames(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id);
  }

  createPending(cls: Class): ControllerConfig {
    return {
      class: cls,
      filters: [],
      headers: {},
      interceptors: [],
      basePath: '',
      externalName: cls.name.replace(/(Controller|Rest|Service)$/, ''),
      endpoints: [],
    };
  }

  createPendingField(cls: Class, handler: RouteHandler): EndpointConfig {
    const controllerConf = this.getOrCreatePending(cls);

    const fieldConf: EndpointConfig = {
      id: `${cls.name}#${handler.name}`,
      path: '/',
      method: 'all',
      class: cls,
      filters: [],
      headers: {},
      params: [],
      interceptors: [],
      handlerName: handler.name,
      handler
    };

    controllerConf.endpoints!.push(fieldConf);

    return fieldConf;
  }

  /**
   * Register the endpoint config
   * @param cls Controller class
   * @param handler Route handler
   */
  getOrCreateEndpointConfig<T>(cls: Class<T>, handler: RouteHandler): EndpointConfig {
    const fieldConf = this.getOrCreatePendingField(cls, handler);
    return asFull(fieldConf);
  }

  /**
   * Register the controller filter
   * @param cls Controller class
   * @param fn The filter to call
   */
  registerControllerFilter(target: Class, fn: Filter): void {
    const config = this.getOrCreatePending(target);
    config.filters!.push(fn);
  }

  /**
   * Register the controller filter
   * @param cls Controller class
   * @param handler Route handler
   * @param fn The filter to call
   */
  registerEndpointFilter(target: Class, handler: RouteHandler, fn: Filter): void {
    const config = this.getOrCreateEndpointConfig(target, handler);
    config.filters!.unshift(fn);
  }

  /**
   * Register the endpoint parameter
   * @param cls Controller class
   * @param handler Route handler
   * @param param The param config
   * @param index The parameter index
   */
  registerEndpointParameter(target: Class, handler: RouteHandler, param: ParamConfig, index: number): void {
    const config = this.getOrCreateEndpointConfig(target, handler);
    if (index >= config.params.length) {
      config.params.length = index + 1;
    }
    config.params[index] = param;
  }

  /**
   * Register the endpoint interceptor config
   * @param cls Controller class
   * @param handler Route handler
   * @param param The param config
   * @param index The parameter index
   */
  registerEndpointInterceptorConfig<T extends RestInterceptor>(target: Class, handler: RouteHandler, interceptorCls: Class<T>, config: Partial<T['config']>): void {
    const endpointConfig = this.getOrCreateEndpointConfig(target, handler);
    (endpointConfig.interceptors ??= []).push([interceptorCls, { disabled: false, ...config }]);
  }

  /**
   * Register the controller interceptor config
   * @param cls Controller class
   * @param param The param config
   * @param index The parameter index
   */
  registerControllerInterceptorConfig<T extends RestInterceptor>(target: Class, interceptorCls: Class<T>, config: Partial<T['config']>): void {
    const controllerConfig = this.getOrCreatePending(target);
    (controllerConfig.interceptors ??= []).push([interceptorCls, { disabled: false, ...config }]);
  }

  /**
   * Create a filter decorator
   * @param fn The filter to call
   */
  createFilterDecorator(fn: Filter): EndpointDecorator {
    return (target: unknown, prop?: symbol | string, descriptor?: TypedPropertyDescriptor<RouteHandler>): void => {
      if (prop) {
        this.registerEndpointFilter(asConstructable(target).constructor, descriptor!.value!, fn);
      } else {
        this.registerControllerFilter(castTo(target), fn);
      }
    };
  }

  /**
   * Register a controller/endpoint with specific config for an interceptor
   * @param cls The interceptor to register data for
   * @param cfg The partial config override
   */
  createInterceptorConfigDecorator<T extends RestInterceptor>(
    cls: Class<T>,
    cfg: Partial<Omit<RetainFields<T['config']>, 'paths'>>
  ): EndpointDecorator {
    return (target: unknown, prop?: symbol | string, descriptor?: TypedPropertyDescriptor<RouteHandler>): void => {
      if (prop && descriptor) {
        this.registerEndpointInterceptorConfig(asConstructable(target).constructor, descriptor!.value!, cls, castTo(cfg));
      } else {
        this.registerControllerInterceptorConfig(castTo(target), cls, castTo(cfg));
      }
    };
  }

  /**
   * Merge describable
   * @param src Root describable (controller, endpoint)
   * @param dest Target (controller, endpoint)
   */
  mergeDescribable(src: Partial<ControllerConfig | EndpointConfig>, dest: Partial<ControllerConfig | EndpointConfig>): void {
    // Coerce to lower case
    const headers = Object.fromEntries(Object.entries(src.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    dest.headers = { ...(dest.headers ?? {}), ...headers };
    dest.filters = [...(dest.filters ?? []), ...(src.filters ?? [])];
    dest.interceptors = [...(dest.interceptors ?? []), ...(src.interceptors ?? [])];
    dest.title = src.title || dest.title;
    dest.description = src.description || dest.description;
    dest.documented = src.documented ?? dest.documented;
  }

  /**
   * Register an endpoint as pending
   * @param target Controller class
   * @param descriptor Prop descriptor
   * @param config The endpoint config
   */
  registerPendingEndpoint(target: Class, descriptor: TypedPropertyDescriptor<RouteHandler>, config: Partial<EndpointConfig>): typeof descriptor {
    const srcConf = this.getOrCreateEndpointConfig(target, descriptor.value!);
    srcConf.method = config.method ?? srcConf.method;
    srcConf.path = config.path || srcConf.path;
    srcConf.responseType = config.responseType ?? srcConf.responseType;
    srcConf.requestType = config.requestType ?? srcConf.requestType;
    srcConf.params = (config.params ?? srcConf.params).map(x => ({ ...x }));

    // Ensure path starts with '/'
    if (!srcConf.path.startsWith('/')) {
      srcConf.path = `/${srcConf.path}`;
    }

    this.mergeDescribable(config, srcConf);

    return descriptor;
  }

  /**
   * Register a pending configuration
   * @param target The target class
   * @param config The controller configuration
   */
  registerPending(target: Class, config: Partial<ControllerConfig>): void {
    const srcConf = this.getOrCreatePending(target);
    srcConf.basePath = config.basePath || srcConf.basePath;

    if (!srcConf.basePath!.startsWith('/')) {
      srcConf.basePath = `/${srcConf.basePath}`;
    }

    this.mergeDescribable(config, srcConf);
  }

  /**
   * Finalize routes, removing duplicates based on ids
   */
  onInstallFinalize(cls: Class): ControllerConfig {
    const final = asFull(this.getOrCreatePending(cls));

    // Store for lookup
    for (const ep of final.endpoints) {
      this.#endpointsById.set(ep.id, ep);
    }

    if (this.has(final.basePath)) {
      console.debug('Reloading controller', { name: cls.name, path: final.basePath });
    }

    return final;
  }

  onUninstallFinalize<T>(cls: Class<T>): void {
    const toDelete = [...this.#endpointsById.values()].filter(x => x.class.name === cls.name);
    for (const k of toDelete) {
      this.#endpointsById.delete(k.id);
    }
    super.onUninstallFinalize(cls);
  }
}

export const ControllerRegistry = new $ControllerRegistry();