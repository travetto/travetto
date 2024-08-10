import { asConstructable, castTo, Class, TimeSpan, TimeUtil } from '@travetto/runtime';

import { HeaderMap, RouteHandler } from '../types';
import { ControllerRegistry } from '../registry/controller';
import { EndpointConfig, ControllerConfig, DescribableConfig, EndpointDecorator } from '../registry/types';
import { AcceptsInterceptor } from '../interceptor/accepts';

function register(config: Partial<EndpointConfig | ControllerConfig>): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: TypedPropertyDescriptor<RouteHandler>) {
    if (descriptor) {
      return ControllerRegistry.registerPendingEndpoint(asConstructable(target).constructor, descriptor, config);
    } else {
      return ControllerRegistry.registerPending(castTo(target), config);
    }
  };
}

/**
 * Decorator used to add description metadata to a class or method
 * @param desc The describe config
 */
export function Describe(desc: DescribableConfig): EndpointDecorator { return register(desc); }

/**
 * Marks a class/endpoint as being undocumented
 */
export function Undocumented(): EndpointDecorator { return register({ documented: false }); }

/**
 * Set response headers on success
 * @param headers The response headers to set
 */
export function SetHeaders(headers: HeaderMap): EndpointDecorator { return register({ headers }); }

/**
 * Specifies content type for response
 */
export function Produces(mime: string): EndpointDecorator { return register({ headers: { 'content-type': mime } }); }


type HeaderSet = ReturnType<typeof SetHeaders>;

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 * @param unit The unit of measurement
 */
export function CacheControl(value: number | TimeSpan): HeaderSet {
  const delta = TimeUtil.asSeconds(value);
  return SetHeaders({
    Expires: delta === 0 ? '-1' : ((): string => TimeUtil.fromNow(delta, 's').toUTCString()),
    'Cache-Control': delta === 0 ? 'max-age=0,no-cache' : `max-age=${delta}`
  });
}

/**
 * Disable cache control, ensuring endpoint will not cache
 */
export const DisableCacheControl = (): HeaderSet => CacheControl('0s');

/**
 * Define an endpoint to support specific input types
 * @param types The list of mime types to allow/deny
 */
export function Accepts(types: string[]): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AcceptsInterceptor, { types });
}

/**
 * Allows for configuring interceptor-level support at an endpoint or controller level
 */
export const ConfigureInterceptor =
  ControllerRegistry.createInterceptorConfigDecorator.bind(ControllerRegistry);