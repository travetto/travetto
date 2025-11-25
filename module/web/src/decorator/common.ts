import { Class, ClassInstance, TimeSpan, TimeUtil } from '@travetto/runtime';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { EndpointConfig, ControllerConfig, EndpointDecorator, EndpointFunctionDescriptor } from '../registry/types.ts';
import { AcceptInterceptor } from '../interceptor/accept.ts';
import { WebInterceptor } from '../types/interceptor.ts';

function isClass(target: unknown, property: unknown,): target is Class<unknown> {
  return !property;
}

function register(config: Partial<EndpointConfig | ControllerConfig>): EndpointDecorator {
  return function <T>(instanceOrCls: ClassInstance | Class<T>, property?: string | symbol, descriptor?: EndpointFunctionDescriptor) {
    if (isClass(instanceOrCls, property)) {
      ControllerRegistryIndex.getForRegister(instanceOrCls).register(config);
    } else {
      ControllerRegistryIndex.getForRegister(instanceOrCls).registerEndpoint(property!, config);
    }
  };
}

/**
 * Set response headers on success
 * @param headers The response headers to set
 */
export function SetHeaders(headers: EndpointConfig['responseHeaders']): EndpointDecorator {
  return register({ responseHeaders: headers });
}

/**
 * Specifies content type for response
 */
export function Produces(mime: string): EndpointDecorator { return SetHeaders({ 'Content-Type': mime }); }

type CacheControlInput = { cacheableAge?: number | TimeSpan, isPrivate?: boolean };

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 */
export function CacheControl(input: TimeSpan | number | CacheControlInput, extra?: Omit<CacheControlInput, 'cacheableAge'>): EndpointDecorator {
  if (typeof input === 'string' || typeof input === 'number') {
    input = { ...extra, cacheableAge: input };
  }
  const { cacheableAge, isPrivate } = input;
  return register({
    responseContext: {
      ...(cacheableAge !== undefined ? { cacheableAge: TimeUtil.asSeconds(cacheableAge) } : {}),
      ...isPrivate !== undefined ? { isPrivate } : {}
    }
  });
}

/**
 * Define an endpoint to support specific input types
 * @param types The list of mime types to allow/deny
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
 */
export const ConfigureInterceptor =
  ControllerRegistryIndex.createInterceptorConfigDecorator.bind(ControllerRegistryIndex);

/**
 * Specifies if endpoint should be conditional
 */
export function ConditionalRegister(handler: () => (boolean | Promise<boolean>)): EndpointDecorator {
  return register({ conditional: handler });
}

/**
 * Registers an interceptor exclusion filter
 */
export function ExcludeInterceptors(interceptorExclude: (val: WebInterceptor) => boolean): EndpointDecorator {
  return register({ interceptorExclude });
};