import { ControllerRegistry, Request, ParamConfig } from '@travetto/rest';
import { Util, AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator } from '..';

function getBound<T>(cls: Class<T>, obj: any, view?: string) {
  try {
    const resolved = SchemaRegistry.get(cls).class; // Get actual class separate from decorator value
    return BindUtil.bindSchema(resolved, obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatible with ${cls.__id}: ${e.message}`);
  }
}

export async function getSchemaBody<T>(req: Request, cls: Class<T>, view?: string) {
  if (Util.isPlainObject(req.body)) {
    const o = getBound(cls, req.body, view);
    if (SchemaRegistry.has(cls)) {
      return await SchemaValidator.validate(o, view);
    } else {
      return o;
    }
  } else {
    throw new AppError(`Body is missing or wrong type: ${req.body}`, 'data');
  }
}

export function SchemaBody<T>(config: Partial<ParamConfig> = {}, view?: string) {
  return function (target: any, prop: string | symbol, idx: number) {
    const handler = target.constructor.prototype[prop];

    if (!config.type) {
      throw new AppError('A schema type is required for binding');
    }

    ControllerRegistry.registerEndpointParameter(target.constructor, handler, {
      ...config as ParamConfig,
      location: 'body',
      async resolve(req: Request) {
        req.body = await getSchemaBody(req, config.type!, view);
      }
    }, idx);
  };
}

export function SchemaQuery<T>(config: Partial<ParamConfig> = {}, view?: string) {
  return function (target: any, prop: string | symbol, idx: number) {
    const handler = target.constructor.prototype[prop];

    if (!config.type) {
      throw new AppError('A schema type is required for binding');
    }

    ControllerRegistry.registerEndpointParameter(target.constructor, handler, {
      ...config as ParamConfig,
      name: '_all',
      location: 'query',
      async resolve(req: Request) {
        const o = getBound(config.type!, BindUtil.expandPaths(req.query), view);
        if (SchemaRegistry.has(config.type!)) {
          req.query._all = await SchemaValidator.validate(o, view);
        } else {
          req.query._all = o;
        }
      }
    }, idx);
  };
}