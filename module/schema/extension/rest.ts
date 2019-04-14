import { ControllerRegistry, Request, ParamConfig } from '@travetto/rest';
import { Util, AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator } from '..';

const getBody = (c: ParamConfig, r: Request) => r.body;
const getQuery = (c: ParamConfig, r: Request) => (r.query._schema && r.query._schema[c.name!]);

export async function getSchemaInstance<T>(obj: any, cls: Class<T>, view?: string) {
  if (!Util.isPlainObject(obj)) {
    throw new AppError(`Object is missing or wrong type: ${obj}`, 'data');
  }

  let bound: T;
  try {
    const resolved = SchemaRegistry.get(cls).class; // Get actual class separate from decorator value
    bound = BindUtil.bindSchema(resolved, obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatible with ${cls.__id}: ${e.message}`);
  }

  if (SchemaRegistry.has(cls)) {
    await SchemaValidator.validate(bound, view);
  }

  return bound;
}

export function SchemaBody<T>(config: Partial<ParamConfig> & { view?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    const handler = target.constructor.prototype[prop];

    if (!config.type) {
      throw new AppError('A schema type is required for binding');
    }

    ControllerRegistry.registerEndpointParameter(target.constructor, handler, {
      ...config as ParamConfig,
      location: 'body',
      async resolve(req: Request) {
        req.body = await getSchemaInstance(req.body, config.type!, config.view);
      },
      extract: getBody
    }, idx);
  };
}

export function SchemaQuery<T>(config: Partial<ParamConfig> & { view?: string, key?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    const handler = target.constructor.prototype[prop];

    if (!config.type) {
      throw new AppError('A schema type is required for binding');
    }

    ControllerRegistry.registerEndpointParameter(target.constructor, handler, {
      ...config as ParamConfig,
      location: 'query',
      async resolve(req: Request) {
        req.query._schema = req.query._schema || {};
        const exploded = BindUtil.expandPaths(req.query);
        req.query._schema[config.name!] = await getSchemaInstance(config.key ? exploded[config.key] : exploded, config.type!, config.view!);
      },
      extract: getQuery
    }, idx);
  };
}