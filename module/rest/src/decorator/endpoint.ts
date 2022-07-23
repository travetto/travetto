import { ClassInstance } from '@travetto/base';

import { MethodOrAll, PathType, RouteHandler } from '../types';

import { ControllerRegistry } from '../registry/controller';
import { EndpointConfig, EndpointIOType } from '../registry/types';

type RouteDescriptor = TypedPropertyDescriptor<RouteHandler>;
type RouteDecorator = <T>(target: T, prop: symbol | string, descriptor: RouteDescriptor) => RouteDescriptor;

function Endpoint(method: MethodOrAll, path: PathType = '/', extra: Partial<EndpointConfig> = {}): RouteDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: RouteDescriptor): RouteDescriptor {
    const ret = ControllerRegistry.registerPendingEndpoint(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (target as ClassInstance<T>).constructor, descriptor, { method, path, ...extra }
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
export function All(path?: PathType): RouteDecorator { return Endpoint('all', path); }
/**
 * Registers GET requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Get(path?: PathType): RouteDecorator { return Endpoint('get', path); }
/**
 * Registers POST requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Post(path?: PathType): RouteDecorator { return Endpoint('post', path); }
/**
 * Registers PUT requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Put(path?: PathType): RouteDecorator { return Endpoint('put', path); }
/**
 * Registers PATCH requests
 * @param path The path to route the request to
 * @augments `@trv:http/Body`
 * @augments `@trv:rest/Endpoint`
 */
export function Patch(path?: PathType): RouteDecorator { return Endpoint('patch', path); }
/**
 * Registers DELETE requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Delete(path?: PathType): RouteDecorator { return Endpoint('delete', path); }
/**
 * Registers HEAD requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Head(path?: PathType): RouteDecorator { return Endpoint('head', path); }
/**
 * Registers OPTIONS requests
 * @param path The path to route the request to
 * @augments `@trv:rest/Endpoint`
 */
export function Options(path?: PathType): RouteDecorator { return Endpoint('options', path); }

/**
 * Defines the response type of the endpoint
 * @param responseType The desired response mime type
 */
export function ResponseType(responseType: EndpointIOType): RouteDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: RouteDescriptor) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ControllerRegistry.registerPendingEndpoint((target as ClassInstance<T>).constructor, descriptor, { responseType });
  };
}

/**
 * Defines the supported request body type
 * @param requestType The type of the request body
 */
export function RequestType(requestType: EndpointIOType): RouteDecorator {
  return function <T>(target: T, property: string | symbol, descriptor: RouteDescriptor) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ControllerRegistry.registerPendingEndpoint((target as ClassInstance<T>).constructor, descriptor, { requestType });
  };
}