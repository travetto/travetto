import { asConstructable } from '@travetto/runtime';

import { HttpMethodOrAll, EndpointHandler } from '../types';

import { ControllerRegistry } from '../registry/controller';
import { EndpointConfig, EndpointIOType } from '../registry/types';

type HttpEndpointDescriptor = TypedPropertyDescriptor<EndpointHandler>;
type HttpEndpointDecorator = <T>(target: T, prop: symbol | string, descriptor: HttpEndpointDescriptor) => HttpEndpointDescriptor;

function Endpoint(method: HttpMethodOrAll, path: string = '/', extra: Partial<EndpointConfig> = {}): HttpEndpointDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: HttpEndpointDescriptor): HttpEndpointDescriptor {
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
export function All(path?: string): HttpEndpointDecorator { return Endpoint('all', path); }
/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Get(path?: string): HttpEndpointDecorator { return Endpoint('get', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Post(path?: string): HttpEndpointDecorator { return Endpoint('post', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Put(path?: string): HttpEndpointDecorator { return Endpoint('put', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 */
export function Patch(path?: string): HttpEndpointDecorator { return Endpoint('patch', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Delete(path?: string): HttpEndpointDecorator { return Endpoint('delete', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Head(path?: string): HttpEndpointDecorator { return Endpoint('head', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 */
export function Options(path?: string): HttpEndpointDecorator { return Endpoint('options', path); }

/**
 * Defines the response type of the endpoint
 * @param responseType The desired response mime type
 */
export function ResponseType(responseType: EndpointIOType): HttpEndpointDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: HttpEndpointDescriptor) {
    return ControllerRegistry.registerPendingEndpoint(asConstructable(target).constructor, descriptor, { responseType });
  };
}

/**
 * Defines the supported request body type
 * @param requestType The type of the request body
 */
export function RequestType(requestType: EndpointIOType): HttpEndpointDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: HttpEndpointDescriptor) {
    return ControllerRegistry.registerPendingEndpoint(asConstructable(target).constructor, descriptor, { requestType });
  };
}