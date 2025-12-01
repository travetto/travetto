import { RegistryAdapter } from '@travetto/registry';
import { AppError, asFull, castTo, Class, RetainPrimitiveFields, safeAssign } from '@travetto/runtime';
import { WebHeaders } from '@travetto/web';
import { SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import { ControllerConfig, EndpointConfig, EndpointParameterConfig, EndpointParamLocation } from './types';
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

function combineEndpointConfigs(ctrl: ControllerConfig, base: EndpointConfig, ...overrides: Partial<EndpointConfig>[]): EndpointConfig {
  for (const override of overrides) {
    combineCommon(base, override);
    Object.assign(
      base,
      {
        cacheable: override.cacheable ?? base.cacheable,
        httpMethod: override.httpMethod ?? base.httpMethod,
        allowsBody: override.allowsBody ?? base.allowsBody,
        path: override.path || base.path,
        parameters: (override.parameters ?? base.parameters).map(x => ({ ...x })),
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
function computeParameterLocation(ep: EndpointConfig, schema: SchemaParameterConfig): EndpointParamLocation {
  const name = schema?.name;
  if (!SchemaRegistryIndex.has(schema.type)) {
    if ((schema.type === String || schema.type === Number) && name && ep.path.includes(`:${name.toString()}`)) {
      return 'path';
    } else if (schema.type === Blob || schema.type === File || schema.type === ArrayBuffer || schema.type === Uint8Array) {
      return 'body';
    }
    return 'query';
  } else {
    return ep.allowsBody ? 'body' : 'query';
  }
}

/**
 * Adapter for controller registry
 */
export class ControllerRegistryAdapter implements RegistryAdapter<ControllerConfig> {
  #config: ControllerConfig;
  #endpoints: Map<string | symbol, EndpointConfig> = new Map();
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

  registerEndpoint(method: string | symbol, ...data: Partial<EndpointConfig>[]): EndpointConfig {
    this.register();

    if (!this.#endpoints.has(method)) {
      const endpointConfig = asFull<EndpointConfig>({
        path: '/',
        fullPath: '/',
        cacheable: false,
        allowsBody: false,
        class: this.#cls,
        filters: [],
        methodName: method.toString(),
        id: `${this.#cls.name}#${method.toString()}`,
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

  registerEndpointParameter(method: string | symbol, index: number, ...config: Partial<EndpointParameterConfig>[]): EndpointParameterConfig {
    const ep = this.registerEndpoint(method);
    ep.parameters[index] ??= { index, location: 'query' };
    safeAssign(ep.parameters[index], ...config);
    return ep.parameters[index];
  }

  finalize(): void {
    // Merge into controller
    for (const ep of this.#config.endpoints) {
      // Store full path from base for use in other contexts
      ep.fullPath = `/${this.#config.basePath}/${ep.path}`.replace(/[/]{1,4}/g, '/').replace(/(.)[/]$/, (_, a) => a);
      ep.finalizedResponseHeaders = new WebHeaders({ ...this.#config.responseHeaders, ...ep.responseHeaders });
      ep.responseContext = { ...this.#config.responseContext, ...ep.responseContext };
      for (const schema of SchemaRegistryIndex.get(this.#cls).getMethod(ep.methodName).parameters) {
        ep.parameters[schema.index!] ??= { index: schema.index!, location: undefined! };
        ep.parameters[schema.index!].location ??= computeParameterLocation(ep, schema);
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

  getEndpointConfig(method: string | symbol): EndpointConfig {
    const endpoint = this.#endpoints.get(method);
    if (!endpoint) {
      throw new AppError(`Endpoint not registered: ${String(method)} on ${this.#cls.name}`);
    }
    return endpoint;
  }

  registerInterceptorConfig<T extends WebInterceptor>(
    cls: Class<T>,
    config: Partial<RetainPrimitiveFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): ControllerConfig {
    return this.register({ interceptorConfigs: [[cls, castTo(config)]], ...extra });
  }

  registerEndpointInterceptorConfig<T extends WebInterceptor>(
    property: string | symbol,
    cls: Class<T>,
    config: Partial<RetainPrimitiveFields<T['config']>>,
    extra?: Partial<EndpointConfig>
  ): EndpointConfig {
    return this.registerEndpoint(property, { interceptorConfigs: [[cls, castTo(config)]], ...extra });
  }

  registerFinalizeHandler(fn: () => void): void {
    this.#finalizeHandlers.push(fn);
  }
}