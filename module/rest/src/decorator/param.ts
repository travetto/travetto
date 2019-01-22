import { Class } from '@travetto/registry';

import { RestError } from '../error';
import { ControllerRegistry } from '../registry';
import { Request, ParamConfig, EndpointConfig, Filter, EndpointDecorator } from '../types';

export function parseParam(type: Class | undefined, name: string, param: any) {
  let typedParam: any = param;
  switch (type) {
    case Date:
      typedParam = Date.parse(param);
      if (Number.isNaN(typedParam)) {
        throw new RestError(`Incorrect field type for ${name}, ${param} is not a Date`, 400);
      }
      break;
    case Boolean:
      if (!/^(0|1|true|false|yes|no)$/i.test(param)) {
        throw new RestError(`Incorrect field type for ${name}, ${param} is not a boolean value`, 400);
      }
      typedParam = param === 'true' || param === '1' || param === 'yes';
      break;
    case Number:
      if (param.includes('.')) {
        typedParam = parseFloat(param);
      } else {
        typedParam = parseInt(param, 10);
      }
      if (Number.isNaN(typedParam)) {
        throw new RestError(`Incorrect field type for ${name}, ${param} is not a number`, 400);
      }
      break;
    case String:
    case undefined: typedParam = `${param}`; break;
  }

  return typedParam;
}

async function paramHandler(config: EndpointConfig, req: Request) {
  for (const { name, required, type, location } of Object.values(config.params)) {
    const finalLoc = location === 'path' ? 'params' : location;
    const param = req[finalLoc][name];

    if (required && !param) {
      throw new RestError(`Missing field: ${name}`, 400);
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