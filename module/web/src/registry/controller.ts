import { DependencyRegistry } from '@travetto/di';
import { type Primitive, type Class, asFull, castTo, asConstructable, ClassInstance } from '@travetto/runtime';
import { MetadataRegistry } from '@travetto/registry';

import { EndpointConfig, ControllerConfig, EndpointDecorator, EndpointParamConfig, EndpointFunctionDescriptor, EndpointFunction } from './types.ts';
import { WebChainedFilter, WebFilter } from '../types/filter.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebHeaders } from '../types/headers.ts';

import { WebAsyncContext } from '../context.ts';

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

  async #bindContextParams<T>(inst: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistry.getInstance(WebAsyncContext);
    const map = this.get(inst.constructor).contextParams;
    for (const [field, type] of Object.entries(map)) {
      Object.defineProperty(inst, field, { get: ctx.getSource(type) });
    }
  }

  getEndpointById(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id.replace(':', '#'));
  }

  createPending(cls: Class): ControllerConfig {
    return {
      class: cls,
      filters: [],
      interceptorConfigs: [],
      basePath: '',
      externalName: cls.name.replace(/(Controller|Web|Service)$/, ''),
      endpoints: [],
      contextParams: {},
    };
  }

  createPendingField(cls: Class, endpoint: EndpointFunction): EndpointConfig {
    const controllerConf = this.getOrCreatePending(cls);

    const fieldConf: EndpointConfig = {
      id: `${cls.name}#${endpoint.name}`,
      path: '/',
      fullPath: '/',
      cacheable: false,
      allowsBody: false,
      class: cls,
      filters: [],
      params: [],
      interceptorConfigs: [],
      name: endpoint.name,
      endpoint,
      responseHeaderMap: new WebHeaders(),
      responseFinalizer: undefined
    };

    controllerConf.endpoints!.push(fieldConf);

    return fieldConf;
  }

  /**
   * Register the endpoint config
   * @param cls Controller class
   * @param endpoint Endpoint target function
   */
  getOrCreateEndpointConfig<T>(cls: Class<T>, endpoint: EndpointFunction): EndpointConfig {
    const fieldConf = this.getOrCreatePendingField(cls, endpoint);
    return asFull(fieldConf);
  }

  /**
   * Register the controller filter
   * @param cls Controller class
   * @param filter The filter to call
   */
  registerControllerFilter(target: Class, filter: WebFilter | WebChainedFilter): void {
    const config = this.getOrCreatePending(target);
    config.filters!.push(filter);
  }

  /**
   * Register the controller filter
   * @param cls Controller class
   * @param endpoint Endpoint function
   * @param filter The filter to call
   */
  registerEndpointFilter(target: Class, endpoint: EndpointFunction, filter: WebFilter | WebChainedFilter): void {
    const config = this.getOrCreateEndpointConfig(target, endpoint);
    config.filters!.unshift(filter);
  }

  /**
   * Register the endpoint parameter
   * @param cls Controller class
   * @param endpoint Endpoint function
   * @param param The param config
   * @param index The parameter index
   */
  registerEndpointParameter(target: Class, endpoint: EndpointFunction, param: EndpointParamConfig, index: number): void {
    const config = this.getOrCreateEndpointConfig(target, endpoint);
    if (index >= config.params.length) {
      config.params.length = index + 1;
    }
    config.params[index] = param;
  }

  /**
   * Register the endpoint interceptor config
   * @param cls Controller class
   * @param endpoint Endpoint function
   * @param param The param config
   * @param index The parameter index
   */
  registerEndpointInterceptorConfig<T extends WebInterceptor>(target: Class, endpoint: EndpointFunction, interceptorCls: Class<T>, config: Partial<T['config']>): void {
    const endpointConfig = this.getOrCreateEndpointConfig(target, endpoint);
    (endpointConfig.interceptorConfigs ??= []).push([interceptorCls, { ...config }]);
  }

  /**
   * Register the controller interceptor config
   * @param cls Controller class
   * @param param The param config
   * @param index The parameter index
   */
  registerControllerInterceptorConfig<T extends WebInterceptor>(target: Class, interceptorCls: Class<T>, config: Partial<T['config']>): void {
    const controllerConfig = this.getOrCreatePending(target);
    (controllerConfig.interceptorConfigs ??= []).push([interceptorCls, { ...config }]);
  }

  /**
   * Register a controller context param
   * @param target Controller class
   * @param field Field on controller to bind context param to
   * @param type The context type to bind to field
   */
  registerControllerContextParam<T>(target: Class, field: string, type: Class<T>): void {
    const controllerConfig = this.getOrCreatePending(target);
    controllerConfig.contextParams![field] = type;
    DependencyRegistry.registerPostConstructHandler(target, 'ContextParam', inst => this.#bindContextParams(inst));
  }

  /**
   * Create a filter decorator
   * @param filter The filter to call
   */
  createFilterDecorator(filter: WebFilter): EndpointDecorator {
    return (target: unknown, prop?: symbol | string, descriptor?: EndpointFunctionDescriptor): void => {
      if (prop) {
        this.registerEndpointFilter(asConstructable(target).constructor, descriptor!.value!, filter);
      } else {
        this.registerControllerFilter(castTo(target), filter);
      }
    };
  }

  /**
   * Register a controller/endpoint with specific config for an interceptor
   * @param cls The interceptor to register data for
   * @param cfg The partial config override
   */
  createInterceptorConfigDecorator<T extends WebInterceptor>(
    cls: Class<T>,
    cfg: Partial<RetainFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): EndpointDecorator {
    return (target: unknown, prop?: symbol | string, descriptor?: EndpointFunctionDescriptor): void => {
      const outCls: Class = descriptor ? asConstructable(target).constructor : castTo(target);
      if (prop && descriptor) {
        this.registerEndpointInterceptorConfig(outCls, descriptor!.value!, cls, castTo(cfg));
        extra && this.registerPendingEndpoint(outCls, descriptor, extra);
      } else {
        this.registerControllerInterceptorConfig(outCls, cls, castTo(cfg));
        extra && this.registerPending(outCls, extra);
      }
    };
  }

  /**
   * Merge describable
   * @param src Root describable (controller, endpoint)
   * @param dest Target (controller, endpoint)
   */
  mergeDescribable(src: Partial<ControllerConfig | EndpointConfig>, dest: Partial<ControllerConfig | EndpointConfig>): void {
    dest.filters = [...(dest.filters ?? []), ...(src.filters ?? [])];
    dest.interceptorConfigs = [...(dest.interceptorConfigs ?? []), ...(src.interceptorConfigs ?? [])];
    dest.interceptorExclude = dest.interceptorExclude ?? src.interceptorExclude;
    dest.title = src.title || dest.title;
    dest.description = src.description || dest.description;
    dest.documented = src.documented ?? dest.documented;
    dest.responseHeaders = { ...src.responseHeaders, ...dest.responseHeaders };
  }

  /**
   * Register an endpoint as pending
   * @param target Controller class
   * @param descriptor Prop descriptor
   * @param config The endpoint config
   */
  registerPendingEndpoint(target: Class, descriptor: EndpointFunctionDescriptor, config: Partial<EndpointConfig>): EndpointFunctionDescriptor {
    const srcConf = this.getOrCreateEndpointConfig(target, descriptor.value!);
    srcConf.cacheable = config.cacheable ?? srcConf.cacheable;
    srcConf.httpMethod = config.httpMethod ?? srcConf.httpMethod;
    srcConf.allowsBody = config.allowsBody ?? srcConf.allowsBody;
    srcConf.path = config.path || srcConf.path;
    srcConf.responseType = config.responseType ?? srcConf.responseType;
    srcConf.requestType = config.requestType ?? srcConf.requestType;
    srcConf.params = (config.params ?? srcConf.params).map(x => ({ ...x }));
    srcConf.responseFinalizer = config.responseFinalizer ?? srcConf.responseFinalizer;

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

    srcConf.contextParams = { ...srcConf.contextParams, ...config.contextParams };


    this.mergeDescribable(config, srcConf);
  }

  /**
   * Finalize endpoints, removing duplicates based on ids
   */
  onInstallFinalize(cls: Class): ControllerConfig {
    const final = asFull(this.getOrCreatePending(cls));

    // Store for lookup
    for (const ep of final.endpoints) {
      this.#endpointsById.set(ep.id, ep);
      // Store full path from base for use in other contexts
      ep.fullPath = `/${final.basePath}/${ep.path}`.replace(/[/]{1,4}/g, '/').replace(/(.)[/]$/, (_, a) => a);
      ep.responseHeaderMap = new WebHeaders({ ...final.responseHeaders ?? {}, ...ep.responseHeaders ?? {} });
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