import { Class, ClassInstance, AppError, TimeSpan, Util } from '@travetto/base';

import { HeaderMap, Request, RouteHandler } from '../types';
import { ControllerRegistry } from '../registry/controller';
import { EndpointConfig, ControllerConfig, DescribableConfig } from '../registry/types';

function register(config: Partial<EndpointConfig | ControllerConfig>) {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: TypedPropertyDescriptor<RouteHandler>) {
    if (descriptor) {
      return ControllerRegistry.registerPendingEndpoint((target as ClassInstance).constructor, descriptor, config);
    } else {
      return ControllerRegistry.registerPending(target as Class, config);
    }
  };
}

/**
 * Decorator used to add description metadata to a class or method
 * @param desc The describe config
 */
export function Describe(desc: DescribableConfig) { return register(desc); }

/**
 * Set response headers on success
 * @param headers The response headers to set
 */
export function SetHeaders(headers: HeaderMap) { return register({ headers }); }

/**
 * Specifies content type for response
 */
export function Produces(mime: string) { return register({ headers: { 'content-type': mime } }); }


type HeaderSet = ReturnType<typeof SetHeaders>;

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 * @param unit The unit of measurement
 */
export function CacheControl(value: number | TimeSpan): HeaderSet {
  const delta = Math.trunc(Util.timeToMs(value) / 1000);
  return SetHeaders({
    Expires: delta === 0 ? '-1' : () => new Date(delta * 1000 + Date.now()).toUTCString(),
    'Cache-Control': () => delta === 0 ? 'max-age=0,no-cache' : `max-age=${delta}`
  });
}

/**
 * Disable cache control, ensuring endpoint will not cache
 */
export const DisableCacheControl = () => CacheControl('0s');

/**
 * Define an endpoint to support specific input types
 * @param contentTypes The list of mime types to support
 */
export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async function (req: Request) {
    const contentType = req.header('content-type');
    if (!contentType || !types.has(contentType as string)) {
      throw new AppError(`Content type ${contentType} not one of ${contentTypes}`, 'data');
    }
  };

  return ControllerRegistry.createFilterDecorator(handler);
}