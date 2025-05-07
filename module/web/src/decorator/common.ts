import { asConstructable, castTo, Class, TimeSpan, TimeUtil } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, ControllerConfig, DescribableConfig, EndpointDecorator, EndpointFunctionDescriptor } from '../registry/types.ts';
import { AcceptInterceptor } from '../interceptor/accept.ts';
import { WebHeaders } from '../types/headers.ts';
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
export function SetHeaders(headers: Record<string, string>): EndpointDecorator {
  return register({ responseHeaders: new WebHeaders(headers) });
}

/**
 * Specifies content type for response
 */
export function Produces(mime: string): EndpointDecorator { return SetHeaders({ 'Content-Type': mime }); }

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 */
export function CacheControl(value: number | TimeSpan, flags: CacheControlFlag[] = []): EndpointDecorator {
  return SetHeaders({ 'Cache-Control': WebCommonUtil.getCacheControlValue(value, flags) });
}

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 */
export function CacheableResponse(value: number | TimeSpan): EndpointDecorator {
  return register({ responseContext: { cacheableAge: TimeUtil.asSeconds(value) } });
}

/**
 * Define an endpoint to support specific input types
 * @param types The list of mime types to allow/deny
 */
export function Accepts(types: [string, ...string[]]): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(
    AcceptInterceptor,
    { types, applies: true },
    { responseHeaders: new WebHeaders({ accepts: types.join(', ') }) }
  );
}

/**
 * Allows for configuring interceptor-level support at an endpoint or controller level
 */
export const ConfigureInterceptor =
  ControllerRegistry.createInterceptorConfigDecorator.bind(ControllerRegistry);

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