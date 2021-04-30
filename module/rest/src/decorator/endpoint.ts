import { ClassInstance } from '@travetto/base';

import { MethodOrAll, PathType, RouteHandler } from '../types';

import { ControllerRegistry } from '../registry/controller';
import { EndpointConfig, EndpointIOType } from '../registry/types';

function Endpoint(method: MethodOrAll, path: PathType = '/', extra: Partial<EndpointConfig> = {}) {
  return function <T>(target: T, prop: symbol | string,
    descriptor: TypedPropertyDescriptor<RouteHandler>
  ) {
    const ret = ControllerRegistry.registerPendingEndpoint(
      (target as unknown as ClassInstance).constructor, descriptor, { method, path, ...extra }
    );
    return ret;
  };
}

/**
 * Registers for ALL HTTP verbs
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function All(path?: PathType) { return Endpoint('all', path); }
/**
 * Registers GET requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Get(path?: PathType) { return Endpoint('get', path); }
/**
 * Registers POST requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Post(path?: PathType) { return Endpoint('post', path); }
/**
 * Registers PUT requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Put(path?: PathType) { return Endpoint('put', path); }
/**
 * Registers PATCH requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Patch(path?: PathType) { return Endpoint('patch', path); }
/**
 * Registers DELETE requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Delete(path?: PathType) { return Endpoint('delete', path); }
/**
 * Registers HEAD requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Head(path?: PathType) { return Endpoint('head', path); }
/**
 * Registers OPTIONS requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Options(path?: PathType) { return Endpoint('options', path); }

/**
 * Defines the response type of the endpoint
 * @param responseType The desired response mime type
 */
export function ResponseType(responseType: EndpointIOType) {
  return function <T>(target: ClassInstance<T>, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { responseType });
  };
}

/**
 * Defines the supported request body type
 * @param requestType The type of the request body
 */
export function RequestType(requestType: EndpointIOType) {
  return function <T>(target: ClassInstance<T>, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { requestType });
  };
}