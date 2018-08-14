import { Method, PathType, ParamConfig, EndpointIOType, EndpointConfig, Filter, EndpointDecorator } from '../types';
import { ControllerRegistry } from '../service';

function Endpoint(method: Method, path: PathType = '/', extra: Partial<EndpointConfig> = {}) {
  return function (target: any, prop: symbol | string, descriptor: TypedPropertyDescriptor<Filter>) {
    const params: { [key: string]: ParamConfig } = {};
    if (typeof path === 'string' && path.includes(':')) {
      path.replace(/:([A-Za-z0-9_]+)/, (a, name) => {
        params[name] = { name, location: 'params', required: true };
        return a;
      });
    }
    const ret = ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { method, path, params, ...extra });
    return ret;
  } as EndpointDecorator;
}

export const All = (path?: PathType) => Endpoint('all', path);
export const Get = (path?: PathType) => Endpoint('get', path);
export const Post = (path?: PathType) => Endpoint('post', path);
export const Put = (path?: PathType) => Endpoint('put', path);
export const Patch = (path?: PathType) => Endpoint('patch', path);
export const Delete = (path?: PathType) => Endpoint('delete', path);
export const Head = (path?: PathType) => Endpoint('head', path);
export const Options = (path?: PathType) => Endpoint('options', path);

export const ResponseType = (responseType: EndpointIOType) => {
  return function (target: any, property: string, descriptor: TypedPropertyDescriptor<Filter>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { responseType });
  } as EndpointDecorator;
};

export const RequestType = (requestType: EndpointIOType) => {
  return function (target: any, property: string, descriptor: TypedPropertyDescriptor<Filter>) {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { requestType });
  } as EndpointDecorator;
};