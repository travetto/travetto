import { Method, PathType, RouteHandler } from '../types';

import { ControllerRegistry } from '../registry/registry';
import { EndpointConfig, EndpointIOType, EndpointDecorator } from '../registry/types';

function Endpoint(method: Method, path: PathType = '/', extra: Partial<EndpointConfig> = {}) {
  return function (target: any, prop: symbol | string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    const ret = ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { method, path, ...extra });
    return ret;
  } as EndpointDecorator;
}

/**
 * Registers for ALL HTTP verbs
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const All = (path?: PathType) => Endpoint('all', path);
/**
 * Registers GET requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Get = (path?: PathType) => Endpoint('get', path);
/**
 * Registers POST requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Post = (path?: PathType) => Endpoint('post', path);
/**
 * Registers PUT requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Put = (path?: PathType) => Endpoint('put', path);
/**
 * Registers PATCH requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Patch = (path?: PathType) => Endpoint('patch', path);
/**
 * Registers DELETE requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Delete = (path?: PathType) => Endpoint('delete', path);
/**
 * Registers HEAD requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Head = (path?: PathType) => Endpoint('head', path);
/**
 * Registers OPTIONS requets
 * @param path The path to route the request to
 * @augments trv/rest/Endpoint
 */
export const Options = (path?: PathType) => Endpoint('options', path);

/**
 * Defines the response type of the endpoint
 * @param responseType The desired response mime type
 */
export const ResponseType = (responseType: EndpointIOType) =>
  function (target: any, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { responseType });
  } as EndpointDecorator;


/**
 * Defines the supported request body type
 * @param requestType The type of the request body
 */
export const RequestType = (requestType: EndpointIOType) =>
  function (target: any, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { requestType });
  } as EndpointDecorator;