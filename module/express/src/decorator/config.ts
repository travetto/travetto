import { Request, Response } from 'express';

import { Class } from '@travetto/registry';

import { PathType, Method, HeaderMap, EndpointConfig, ControllerConfig, ParamConfig, DescribableConfig, EndpointIOType } from '../types';
import { ControllerRegistry } from '../service';
import { AppError } from '../model';

const MIN = 1000 * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;

const UNIT_MAPPING = { s: 1000, ms: 1, m: MIN, h: HOUR, d: DAY, w: DAY * 7, y: DAY * 365 };
type Units = keyof (typeof UNIT_MAPPING);

export function Controller(path = '') {
  return (target: Class) => {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  };
}

function Endpoint(method: Method, path: PathType = '/') {
  return (target: any, prop: symbol | string, descriptor: TypedPropertyDescriptor<any>) => {
    const params: ParamConfig[] = [];
    if (typeof path === 'string' && path.includes(':')) {
      path = path.replace(/:([A-Za-z0-9_]+)(!([a-zA-z]+))?/, (a, name, b, type) => {
        params.push({
          name,
          location: 'path',
          type: type || 'string'
        });
        return `:${name}`;
      });
    }
    const ret = ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, { method, path, params });
    return ret;
  };
}

function register(config: Partial<EndpointConfig | ControllerConfig>) {
  return (target: any, property?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, config);
    } else {
      return ControllerRegistry.registerPending(target, config);
    }
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

export const Describe = (desc: DescribableConfig) => register(desc);

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

export const Header = (headers: HeaderMap) => register({ headers });
export const NoCache = () => register({
  headers: {
    Expires: '-1',
    'Cache-Control': 'max-age=0, no-cache'
  }
});

export function Cache(value: number, unit: Units = 's') {
  const delta = UNIT_MAPPING[unit] * value;
  return Header({
    Expires: () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}`
  });
}

async function paramHandler(config: EndpointConfig, req: Request, res: Response) {
  for (const { name, required, type, location } of config.params) {
    let param;
    switch (location) {
      case 'path': param = req.params[name]; break;
      case 'query': param = req.query[name]; break;
      case 'body': param = req.body[name]; break;
    }

    if (required && !param) {
      throw new AppError(`Missing field: ${name}`, 400);
    } else if (param !== null) {
      try {
        let typedParam = param;
        switch (type) {
          case Date: typedParam = Date.parse(param); break;
          case Boolean: typedParam = param === 'true' || param === '1'; break;
          case Number: typedParam = parseFloat(param); break;
          // case 'int': typedParam = parseInt(param, 10); break;
          case String:
          case undefined: typedParam = `${param}`; break;
        }

        switch (location) {
          case 'path': req.params[name] = typedParam; break;
          case 'query': req.query[name] = typedParam; break;
          case 'body': req.body[name] = typedParam; break;
        }
      } catch {
        throw new AppError(`Incorrect field type: ${name}`, 400);
      }
    }
  }
}

export const Param = (param: ParamConfig) => {
  return (target: any, property: string, descriptor: PropertyDescriptor) => {
    const existing = ControllerRegistry.getOrCreatePendingField(target.constructor as Class, descriptor.value);
    if (existing.params!.length) {
      ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor!, { filters: [paramHandler.bind(null, existing)] });
    }
    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor!, { params: [param] });
    return descriptor;
  };
};

export const PathParam = (param: Partial<ParamConfig>) => {
  return Param({ type: 'string', location: 'path', ...(param as ParamConfig) });
};

export const QueryParam = (param: Partial<ParamConfig>) => {
  return Param({ type: 'string', location: 'query', ...(param as ParamConfig) });
};

export const BodyParam = (param: Partial<ParamConfig>) => {
  return Param({ type: 'object', location: 'body', ...(param as ParamConfig) });
};