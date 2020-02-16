import { Method, PathType, RouteHandler } from '../types';

import { ControllerRegistry } from '../registry/registry';
import { EndpointConfig, EndpointIOType, EndpointDecorator } from '../registry/types';

function Endpoint(method: Method, path: PathType = '/', extra: Partial<EndpointConfig> = {}) {
  return function (target: any, prop: symbol | string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    const ret = ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { method, path, ...extra });
    return ret;
  } as EndpointDecorator;
}
/** @alias trv/rest/Endpoint */
export const All = (path?: PathType) => Endpoint('all', path);
/** @alias trv/rest/Endpoint */
export const Get = (path?: PathType) => Endpoint('get', path);
/** @alias trv/rest/Endpoint */
export const Post = (path?: PathType) => Endpoint('post', path);
/** @alias trv/rest/Endpoint */
export const Put = (path?: PathType) => Endpoint('put', path);
/** @alias trv/rest/Endpoint */
export const Patch = (path?: PathType) => Endpoint('patch', path);
/** @alias trv/rest/Endpoint */
export const Delete = (path?: PathType) => Endpoint('delete', path);
/** @alias trv/rest/Endpoint */
export const Head = (path?: PathType) => Endpoint('head', path);
/** @alias trv/rest/Endpoint */
export const Options = (path?: PathType) => Endpoint('options', path);

export const ResponseType = (responseType: EndpointIOType) =>
  function (target: any, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { responseType });
  } as EndpointDecorator;

export const RequestType = (requestType: EndpointIOType) =>
  function (target: any, property: string, descriptor: TypedPropertyDescriptor<RouteHandler>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { requestType });
  } as EndpointDecorator;