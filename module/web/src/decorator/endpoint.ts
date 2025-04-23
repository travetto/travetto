import { asConstructable } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, EndpointFunctionDescriptor, EndpointIOType } from '../registry/types.ts';
import { HTTP_METHODS, HttpMethod } from '../types/core.ts';

type EndpointFunctionDecorator = <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

type EndpointDecConfig = Partial<EndpointConfig> & { path: string };

/**
 * Generic Endpoint Decorator
 */
export function Endpoint(config: EndpointDecConfig): EndpointFunctionDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor): EndpointFunctionDescriptor {
    const result = ControllerRegistry.registerPendingEndpoint(
      asConstructable(target).constructor, descriptor, config
    );
    return result;
  };
}


function HttpEndpoint(method: HttpMethod, path: string): EndpointFunctionDecorator {
  const { body: allowsBody, cacheable, emptyStatusCode } = HTTP_METHODS[method];
  return Endpoint({
    path,
    allowsBody,
    cacheable,
    httpMethod: method,
    responseFinalizer: v => {
      v.context.httpStatusCode ??= (v.body === null || v.body === undefined || v.body === '') ? emptyStatusCode : 200;
      return v;
    }
  });
}

/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Get(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('GET', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Post(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('POST', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Put(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PUT', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Patch(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PATCH', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Delete(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('DELETE', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Head(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('HEAD', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Options(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('OPTIONS', path); }

/**
 * Defines the response type of the endpoint
 * @param responseType The desired response mime type
 */
export function ResponseType(responseType: EndpointIOType): EndpointFunctionDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: EndpointFunctionDescriptor) {
    return ControllerRegistry.registerPendingEndpoint(asConstructable(target).constructor, descriptor, { responseType });
  };
}

/**
 * Defines the supported request body type
 * @param requestType The type of the request body
 */
export function RequestType(requestType: EndpointIOType): EndpointFunctionDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: EndpointFunctionDescriptor) {
    return ControllerRegistry.registerPendingEndpoint(asConstructable(target).constructor, descriptor, { requestType });
  };
}