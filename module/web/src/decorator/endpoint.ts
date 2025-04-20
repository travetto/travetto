import { asConstructable } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, EndpointFunctionDescriptor, EndpointIOType } from '../registry/types.ts';
import { HTTP_METHODS, HttpMethod } from '@travetto/web';

type EndpointFunctionDecorator = <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

function Endpoint(config: { path: string } & Partial<EndpointConfig>): EndpointFunctionDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor): EndpointFunctionDescriptor {
    const ret = ControllerRegistry.registerPendingEndpoint(
      asConstructable(target).constructor, descriptor, config
    );
    return ret;
  };
}

function buildConfig(method: HttpMethod, path: string): Partial<EndpointConfig> & { path: string } {
  const { body: allowsBody, cacheable } = HTTP_METHODS[method];
  return { path, allowsBody, cacheable, httpMethod: method };
}

/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Get(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('GET', path)); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Post(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('POST', path)); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Put(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('PUT', path)); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Patch(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('PATCH', path)); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Delete(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('DELETE', path)); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Head(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('HEAD', path)); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Options(path = '/'): EndpointFunctionDecorator { return Endpoint(buildConfig('OPTIONS', path)); }

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