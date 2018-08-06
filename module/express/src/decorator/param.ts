import { Request, Response } from 'express';
import { Class } from '@travetto/registry';

import { AppError } from '../model';
import { ControllerRegistry } from '../service';
import { ParamConfig, EndpointConfig } from '../types';

async function paramHandler(config: EndpointConfig, req: Request, res: Response) {
  for (const { name, required, type, location } of Object.values(config.params)) {
    let param: string | undefined;
    switch (location) {
      case 'path': param = req.params[name]; break;
      case 'query': param = req.query[name]; break;
      case 'body': param = req.body[name]; break;
    }

    if (required && !param) {
      throw new AppError(`Missing field: ${name}`, 400);
    } else if (param) {
      let typedParam: any = param;
      switch (type) {
        case Date:
          typedParam = Date.parse(param);
          if (Number.isNaN(typedParam)) {
            throw new AppError(`Incorrect field type for ${name}, ${param} is not a Date`, 400);
          }
          break;
        case Boolean:
          if (!/^(0|1|true|false|yes|no)$/i.test(param)) {
            throw new AppError(`Incorrect field type for ${name}, ${param} is not a boolean value`, 400);
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
            throw new AppError(`Incorrect field type for ${name}, ${param} is not a number`, 400);
          }
          break;
        case String:
        case undefined: typedParam = `${param}`; break;
      }

      switch (location) {
        case 'path': req.params[name] = typedParam; break;
        case 'query': req.query[name] = typedParam; break;
        case 'body': req.body[name] = typedParam; break;
      }
    }
  }
}

export const Param = (param: ParamConfig) => {
  return (target: any, property: string, descriptor: PropertyDescriptor) => {
    const existing = ControllerRegistry.getOrCreatePendingField(target.constructor as Class, descriptor.value);
    const config: Partial<EndpointConfig> = { params: { [param.name]: param } };
    if (Object.keys(existing.params!).length === 0) {
      config.filters = [paramHandler.bind(null, existing)];
    }
    ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor!, config);
    return descriptor;
  };
};

export const PathParam = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'path', ...(param as ParamConfig) });
};

export const QueryParam = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'query', ...(param as ParamConfig) });
};

export const BodyParam = (param: Partial<ParamConfig>) => {
  return Param({ type: Object, location: 'body', ...(param as ParamConfig) });
};