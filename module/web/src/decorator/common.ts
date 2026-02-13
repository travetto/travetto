import { type Class, type ClassInstance, getClass, type RetainIntrinsicFields, type TimeSpan, TimeUtil } from '@travetto/runtime';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import type { EndpointConfig, ControllerConfig, EndpointDecorator, EndpointFunctionDescriptor } from '../registry/types.ts';
import { AcceptInterceptor } from '../interceptor/accept.ts';
import type { WebInterceptor } from '../types/interceptor.ts';

function isClass(target: unknown, property: unknown,): target is Class<unknown> {
  return !property;
}

function register(config: Partial<EndpointConfig | ControllerConfig>): EndpointDecorator {
  return function <T>(instanceOrCls: ClassInstance | Class<T>, property?: string, _?: EndpointFunctionDescriptor) {
    const adapter = ControllerRegistryIndex.getForRegister(getClass(instanceOrCls));
    if (isClass(instanceOrCls, property)) {
      adapter.register(config);
    } else {
      adapter.registerEndpoint(property!, config);
    }
  };
}

/**
 * Set response headers on success
 * @param headers The response headers to set
 * @kind decorator
 */
export function SetHeaders(headers: EndpointConfig['responseHeaders']): EndpointDecorator {
  return register({ responseHeaders: headers });
}

/**
 * Specifies content type for response
 * @kind decorator
 */
export function Produces(mime: string): EndpointDecorator { return SetHeaders({ 'Content-Type': mime }); }

type CacheControlInput = { cacheableAge?: number | TimeSpan, isPrivate?: boolean };

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 * @kind decorator
 */
export function CacheControl(input: TimeSpan | number | CacheControlInput, extra?: Omit<CacheControlInput, 'cacheableAge'>): EndpointDecorator {
  if (typeof input === 'string' || typeof input === 'number') {
    input = { ...extra, cacheableAge: input };
  }
  const { cacheableAge, isPrivate } = input;
  return register({
    responseContext: {
      ...(cacheableAge !== undefined ? { cacheableAge: TimeUtil.duration(cacheableAge, 's') } : {}),
      ...isPrivate !== undefined ? { isPrivate } : {}
    }
  });
}

/**
 * Define an endpoint to support specific input types
 * @param types The list of mime types to allow/deny
 * @kind decorator
 */
export function Accepts(types: [string, ...string[]]): EndpointDecorator {
  return ControllerRegistryIndex.createInterceptorConfigDecorator(
    AcceptInterceptor,
    { types, applies: true },
    { responseHeaders: { accepts: types.join(', ') } }
  );
}

/**
 * Allows for configuring interceptor-level support at an endpoint or controller level
 * @kind decorator
 */
export const ConfigureInterceptor = <T extends WebInterceptor>(
  cls: Class<T>,
  config: Partial<RetainIntrinsicFields<T['config']>>,
  extra?: Partial<EndpointConfig & ControllerConfig>
): EndpointDecorator =>
  ControllerRegistryIndex.createInterceptorConfigDecorator(cls, config, extra);

/**
 * Specifies if endpoint should be conditional
 * @kind decorator
 */
export function ConditionalRegister(handler: () => (boolean | Promise<boolean>)): EndpointDecorator {
  return register({ conditional: handler });
}

/**
 * Registers an interceptor exclusion filter
 * @kind decorator
 */
export function ExcludeInterceptors(interceptorExclude: (value: WebInterceptor) => boolean): EndpointDecorator {
  return register({ interceptorExclude });
};