import { asConstructable, castTo, Class, TimeSpan } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, ControllerConfig, DescribableConfig, EndpointDecorator, EndpointFunctionDescriptor } from '../registry/types.ts';
import { AcceptsInterceptor } from '../interceptor/accepts.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebCommonUtil, CacheControlFlag } from '../util/common.ts';

function register(config: Partial<EndpointConfig | ControllerConfig>): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: EndpointFunctionDescriptor) {
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
export function SetHeaders(headers: EndpointConfig['responseHeaders']): EndpointDecorator {
  return register({ responseHeaders: headers });
}

/**
 * Specifies content type for response
 */
export function Produces(mime: string): EndpointDecorator { return SetHeaders({ 'Content-Type': mime }); }

/**
 * Specifies if endpoint should be conditional
 */
export function ConditionalRegister(handler: () => (boolean | Promise<boolean>)): EndpointDecorator {
  return register({ conditional: handler });
}

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 * @param unit The unit of measurement
 */
export function CacheControl(value: number | TimeSpan, flags: CacheControlFlag[] = []): EndpointDecorator {
  return SetHeaders({ 'Cache-Control': WebCommonUtil.getCacheControlValue(value, flags) });
}

/**
 * Disable cache control, ensuring endpoint will not cache
 */
export const DisableCacheControl = (): EndpointDecorator => CacheControl(0);

/**
 * Define an endpoint to support specific input types
 * @param types The list of mime types to allow/deny
 */
export function Accepts(types: [string, ...string[]]): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(
    AcceptsInterceptor,
    { types, applies: true },
    { responseHeaders: { accepts: types[0] } }
  );
}

/**
 * Allows for configuring interceptor-level support at an endpoint or controller level
 */
export const ConfigureInterceptor =
  ControllerRegistry.createInterceptorConfigDecorator.bind(ControllerRegistry);

/**
 * Registers an interceptor exclusion filter
 */
export function ExcludeInterceptors(interceptorExclude: (val: WebInterceptor) => boolean): EndpointDecorator {
  return register({ interceptorExclude });
};