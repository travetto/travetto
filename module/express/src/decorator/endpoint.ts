import { Method, PathType, ParamConfig, EndpointIOType } from '../types';
import { ControllerRegistry } from '../service';

function Endpoint(method: Method, path: PathType = '/') {
  return (target: any, prop: symbol | string, descriptor: TypedPropertyDescriptor<any>) => {
    const params: { [key: string]: ParamConfig } = {};
    if (typeof path === 'string' && path.includes(':')) {
      path.replace(/:([A-Za-z0-9_]+)/, (a, name) => {
        params[name] = { name, location: 'path' };
        return a;
      });
    }
    const ret = ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { method, path, params });
    return ret;
  };
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
  return (target: any, property: string, descriptor: TypedPropertyDescriptor<any>) => {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { responseType });
  };
};

export const RequestType = (requestType: EndpointIOType) => {
  return (target: any, property: string, descriptor: TypedPropertyDescriptor<any>) => {
    return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { requestType });
  };
};