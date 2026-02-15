import type { RegistryAdapter } from '@travetto/registry';
import { RuntimeError, asFull, castTo, type Class, type RetainIntrinsicFields, safeAssign } from '@travetto/runtime';
import { WebHeaders } from '@travetto/web';
import { type SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { ControllerConfig, EndpointConfig, EndpointParameterConfig, EndpointParamLocation } from './types.ts';
import type { WebInterceptor } from '../types/interceptor.ts';

function combineCommon<T extends ControllerConfig | EndpointConfig>(base: T, override: Partial<T>): T {
  base.filters = [...(base.filters ?? []), ...(override.filters ?? [])];
  base.interceptorConfigs = [...(base.interceptorConfigs ?? []), ...(override.interceptorConfigs ?? [])];
  base.interceptorExclude = base.interceptorExclude ?? override.interceptorExclude;
  base.responseHeaders = { ...override.responseHeaders, ...base.responseHeaders };
  base.responseContext = { ...override.responseContext, ...base.responseContext };
  return base;
}

function combineClassConfigs(base: ControllerConfig, ...overrides: Partial<ControllerConfig>[]): ControllerConfig {
  for (const override of overrides) {
    combineCommon(base, override);
    Object.assign(base, {
      basePath: override.basePath || base.basePath,
      contextParams: { ...base.contextParams, ...override.contextParams },
    });
  }
  // Ensure we have full path
  if (!base.basePath.startsWith('/')) {
    base.basePath = `/${base.basePath}`;
  }
  return base;
}

function combineEndpointConfigs(controller: ControllerConfig, base: EndpointConfig, ...overrides: Partial<EndpointConfig>[]): EndpointConfig {
  for (const override of overrides) {
    combineCommon(base, override);
    Object.assign(
      base,
      {
        cacheable: override.cacheable ?? base.cacheable,
        httpMethod: override.httpMethod ?? base.httpMethod,
        allowsBody: override.allowsBody ?? base.allowsBody,
        path: override.path || base.path,
        parameters: (override.parameters ?? base.parameters).map(endpoint => ({ ...endpoint })),
        responseFinalizer: override.responseFinalizer ?? base.responseFinalizer,
      }
    );
  }
  // Ensure we have full path
  if (!base.path.startsWith('/')) {
    base.path = `/${base.path}`;
  }
  return base;
}

/**
 * Compute the location of a parameter within an endpoint
 */
function computeParameterLocation(endpoint: EndpointConfig, param: SchemaParameterConfig): EndpointParamLocation {
  const name = param?.name;
  if (!SchemaRegistryIndex.has(param.type)) {
    if ((param.type === String || param.type === Number) && name && endpoint.path.includes(`:${name}`)) {
      return 'path';
    } else if (param.binary) {
      return 'body';
    }
    return 'query';
  } else {
    return endpoint.allowsBody ? 'body' : 'query';
  }
}

/**
 * Adapter for controller registry
 */
export class ControllerRegistryAdapter implements RegistryAdapter<ControllerConfig> {
  #config: ControllerConfig;
  #endpoints: Map<string, EndpointConfig> = new Map();
  #cls: Class;
  #finalizeHandlers: Function[] = [];

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ControllerConfig>[]): ControllerConfig {
    this.#config ??= {
      class: this.#cls,
      filters: [],
      interceptorConfigs: [],
      basePath: '',
      externalName: this.#cls.name.replace(/(Controller|Web|Service)$/, ''),
      endpoints: [],
      contextParams: {},
      responseHeaders: {}
    };
    combineClassConfigs(this.#config, ...data);
    return this.#config;
  }

  registerEndpoint(method: string, ...data: Partial<EndpointConfig>[]): EndpointConfig {
    this.register();

    if (!this.#endpoints.has(method)) {
      const endpointConfig = asFull<EndpointConfig>({
        path: '/',
        fullPath: '/',
        cacheable: false,
        allowsBody: false,
        class: this.#cls,
        filters: [],
        methodName: method,
        id: `${this.#cls.name}#${method}`,
        parameters: [],
        interceptorConfigs: [],
        responseHeaders: {},
        finalizedResponseHeaders: new WebHeaders(),
        responseFinalizer: undefined
      });
      this.#config.endpoints.push(endpointConfig);
      this.#endpoints.set(method, endpointConfig);
    }

    combineEndpointConfigs(this.#config, this.#endpoints.get(method)!, ...data);
    return this.#endpoints.get(method)!;
  }

  registerEndpointParameter(method: string, idx: number, ...config: Partial<EndpointParameterConfig>[]): EndpointParameterConfig {
    const endpoint = this.registerEndpoint(method);
    endpoint.parameters[idx] ??= { index: idx, location: 'query' };
    safeAssign(endpoint.parameters[idx], ...config);
    return endpoint.parameters[idx];
  }

  finalize(): void {
    // Merge into controller
    for (const endpoint of this.#config.endpoints) {
      // Store full path from base for use in other contexts
      endpoint.fullPath = `/${this.#config.basePath}/${endpoint.path}`.replace(/[/]{1,4}/g, '/').replace(/(.)[/]$/, (_, a) => a);
      endpoint.finalizedResponseHeaders = new WebHeaders({ ...this.#config.responseHeaders, ...endpoint.responseHeaders });
      endpoint.responseContext = { ...this.#config.responseContext, ...endpoint.responseContext };
      for (const schema of SchemaRegistryIndex.get(this.#cls).getMethod(endpoint.methodName).parameters) {
        endpoint.parameters[schema.index!] ??= { index: schema.index!, location: undefined! };
        endpoint.parameters[schema.index!].location ??= computeParameterLocation(endpoint, schema);
      }
    }
    for (const item of this.#finalizeHandlers) {
      item();
    }
    this.#finalizeHandlers = [];
  }

  get(): ControllerConfig {
    return this.#config;
  }

  getEndpointConfig(method: string): EndpointConfig {
    const endpoint = this.#endpoints.get(method);
    if (!endpoint) {
      throw new RuntimeError(`Endpoint not registered: ${String(method)} on ${this.#cls.name}`);
    }
    return endpoint;
  }

  registerInterceptorConfig<T extends WebInterceptor>(
    cls: Class<T>,
    config: Partial<RetainIntrinsicFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): ControllerConfig {
    return this.register({ interceptorConfigs: [[cls, castTo(config)]], ...extra });
  }

  registerEndpointInterceptorConfig<T extends WebInterceptor>(
    property: string,
    cls: Class<T>,
    config: Partial<RetainIntrinsicFields<T['config']>>,
    extra?: Partial<EndpointConfig>
  ): EndpointConfig {
    return this.registerEndpoint(property, { interceptorConfigs: [[cls, castTo(config)]], ...extra });
  }

  registerFinalizeHandler(fn: () => void): void {
    this.#finalizeHandlers.push(fn);
  }
}