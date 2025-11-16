import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { AppError, asFull, castTo, Class, RetainPrimitiveFields } from '@travetto/runtime';
import { WebHeaders } from '@travetto/web';
import { SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import { ControllerConfig, EndpointConfig, EndpointParamConfig, EndpointParamLocation } from './types';
import type { WebInterceptor } from '../types/interceptor.ts';

function combineCommon<T extends ControllerConfig | EndpointConfig>(base: T, override: Partial<T>): T {
  base.filters = [...(base.filters ?? []), ...(override.filters ?? [])];
  base.interceptorConfigs = [...(base.interceptorConfigs ?? []), ...(override.interceptorConfigs ?? [])];
  base.interceptorExclude = base.interceptorExclude ?? override.interceptorExclude;
  base.documented = override.documented ?? base.documented;
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
        params: (override.params ?? base.params).map(x => ({ ...x })),
        responseFinalizer: override.responseFinalizer ?? base.responseFinalizer,
      },
      'endpoint' in override && override.endpoint ? {
        id: `${ctrl.class.name}#${override.endpoint.name}`,
        name: override.endpoint.name,
      } : {}
    );
  }
  // Ensure we have full path
  if (!base.path.startsWith('/')) {
    base.path = `/${base.path}`;
  }
  return base;
}

/**
 * Adapter for controller registry
 */
export class ControllerRegistryAdapter implements RegistryAdapter<ControllerConfig> {
  indexCls: RegistryIndexClass<ControllerConfig>;

  #config: ControllerConfig;
  #endpoints: Map<string | symbol, EndpointConfig> = new Map();
  #cls: Class;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  computeParameterLocation(ep: EndpointConfig, schema: SchemaParameterConfig, param: EndpointParamConfig): EndpointParamLocation {
    if (param.location) {
      return param.location;
    }

    const name = param?.name ?? schema?.name;

    if (!SchemaRegistryIndex.has(schema.type)) {
      if (schema.type === String && name && ep.path.includes(`:${name.toString()}`)) {
        return 'path';
      }
      return 'query';
    } else {
      return ep.allowsBody ? 'body' : 'query';
    }
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
        name: method.toString(),
        params: [],
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

  finalize(): void {
    // Merge into controller
    for (const ep of this.#config.endpoints) {
      // Store full path from base for use in other contexts
      ep.fullPath = `/${this.#config.basePath}/${ep.path}`.replace(/[/]{1,4}/g, '/').replace(/(.)[/]$/, (_, a) => a);
      ep.finalizedResponseHeaders = new WebHeaders({ ...this.#config.responseHeaders, ...ep.responseHeaders });
      ep.responseContext = { ...this.#config.responseContext, ...ep.responseContext };

      const schema = SchemaRegistryIndex.getMethodConfig(ep.class, ep.name).parameters;
      ep.params = schema.map(s => ({
        name: s.name,
        ...ep.params[s.index!],
        index: s.index!,
        location: this.computeParameterLocation(ep, s, ep.params[s.index!] ?? {})
      }));
    }
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
    cfg: Partial<RetainPrimitiveFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): ControllerConfig {
    return this.register({ interceptorConfigs: [[cls, castTo(cfg)]], ...extra });
  }

  registerEndpointInterceptorConfig<T extends WebInterceptor>(
    prop: string | symbol,
    cls: Class<T>,
    cfg: Partial<RetainPrimitiveFields<T['config']>>,
    extra?: Partial<EndpointConfig>
  ): EndpointConfig {
    return this.registerEndpoint(prop, { interceptorConfigs: [[cls, castTo(cfg)]], ...extra });
  }
}