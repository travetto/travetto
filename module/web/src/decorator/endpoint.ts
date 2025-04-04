import { asConstructable } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, EndpointFunctionDescriptor, EndpointIOType } from '../registry/types.ts';
import { HttpMethodWithAll } from '../types/core.ts';

type EndpointFunctionDecorator = <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

function Endpoint(method: HttpMethodWithAll, path: string = '/', extra: Partial<EndpointConfig> = {}): EndpointFunctionDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor): EndpointFunctionDescriptor {
    const ret = ControllerRegistry.registerPendingEndpoint(
      asConstructable(target).constructor, descriptor, { method, path, ...extra }
    );
    return ret;
  };
}

/**
 * Registers for ALL HTTP verbs
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function All(path?: string): EndpointFunctionDecorator { return Endpoint('ALL', path); }
/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Get(path?: string): EndpointFunctionDecorator { return Endpoint('GET', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Post(path?: string): EndpointFunctionDecorator { return Endpoint('POST', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Put(path?: string): EndpointFunctionDecorator { return Endpoint('PUT', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Patch(path?: string): EndpointFunctionDecorator { return Endpoint('PATCH', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Delete(path?: string): EndpointFunctionDecorator { return Endpoint('DELETE', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Head(path?: string): EndpointFunctionDecorator { return Endpoint('HEAD', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Options(path?: string): EndpointFunctionDecorator { return Endpoint('OPTIONS', path); }

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