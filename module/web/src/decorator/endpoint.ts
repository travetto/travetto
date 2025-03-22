import { asConstructable } from '@travetto/runtime';

import { HttpMethodOrAll } from '../types.ts';

import { ControllerRegistry } from '../registry/controller.ts';
import { EndpointConfig, EndpointFunctionDescriptor, EndpointIOType } from '../registry/types.ts';

type EndpointFunctionDecorator = <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

function Endpoint(method: HttpMethodOrAll, path: string = '/', extra: Partial<EndpointConfig> = {}): EndpointFunctionDecorator {
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
export function All(path?: string): EndpointFunctionDecorator { return Endpoint('all', path); }
/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Get(path?: string): EndpointFunctionDecorator { return Endpoint('get', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Post(path?: string): EndpointFunctionDecorator { return Endpoint('post', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Put(path?: string): EndpointFunctionDecorator { return Endpoint('put', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Patch(path?: string): EndpointFunctionDecorator { return Endpoint('patch', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Delete(path?: string): EndpointFunctionDecorator { return Endpoint('delete', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Head(path?: string): EndpointFunctionDecorator { return Endpoint('head', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Options(path?: string): EndpointFunctionDecorator { return Endpoint('options', path); }

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