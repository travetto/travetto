import { Class } from '@travetto/registry';
import { Util, AppError } from '@travetto/base';

import { Request, Filter } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { ParamConfig, EndpointConfig, EndpointDecorator } from '../registry/types';

export function parseParam(type: Class | undefined, name: string, param: any) {
  try {
    switch (type) {
      case Date: return Util.coerceType(param, new Date());
      case Boolean: return Util.coerceType(param, true);
      case Number: return Util.coerceType(param, 0);
      case String:
      case undefined: return `${param}`;
    }
  } catch (e) {
    throw new AppError(`Incorrect field type for ${name}, ${param} is not a ${type!.name}`, 'data');
  }
}

async function paramHandler(config: EndpointConfig, req: Request) {
  for (const { name, required, type, location } of Object.values(config.params)) {
    const finalLoc = location === 'path' ? 'params' : location;
    const param = req[finalLoc][name];

    if (required && !param) {
      throw new AppError(`Missing field: ${name}`, 'data');
    } else if (param) {
      (req as any)[finalLoc][name] = parseParam(type, name, param);
    }
  }
}

export const Param = (param: ParamConfig) => {
  return function (target: any, property: string, descriptor: TypedPropertyDescriptor<Filter>) {
    const existing = ControllerRegistry.getOrCreatePendingField(target.constructor as Class, descriptor.value!);
    const config: Partial<EndpointConfig> = { params: { [param.name]: param } };
    if (Object.keys(existing.params!).length === 0) {
      config.filters = [paramHandler.bind(null, existing as EndpointConfig)];
    }
    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor!, config);
    return descriptor;
  } as EndpointDecorator;
};

export const PathParam = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'path', required: true, ...(param as ParamConfig) });
};

export const QueryParam = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'query', required: false, ...(param as ParamConfig) });
};

export const BodyParam = (param: Partial<ParamConfig>) => {
  return Param({ type: Object, location: 'body', required: true, ...(param as ParamConfig) });
};