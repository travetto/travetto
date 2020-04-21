import { ControllerRegistry, Request, ParamConfig, ExtractFn } from '@travetto/rest';
import { Util, AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator } from '..';
import { Schema } from 'js-yaml';

const QUERY_SCHEMA: unique symbol = Symbol('_query_schema');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Travetto {
    interface Request {
      [QUERY_SCHEMA]: Record<string, Schema>;
    }
  }
}


const EXTRACTORS: Record<'body' | 'query', ExtractFn> = {
  body: (c, r) => r.body,
  query: (c, r) => r[QUERY_SCHEMA] && r[QUERY_SCHEMA][c.name!]
};

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

export function schemaParamConfig(location: 'body' | 'query', config: Partial<ParamConfig> & { view?: string, key?: string } = {}): ParamConfig {
  if (!config.type) {
    throw new AppError('A schema type is required for binding');
  }

  config.name = config.name || location;

  return {
    ...config as ParamConfig,
    location,
    resolve: location === 'query' ?
      async (req: Request) => {
        const cls = SchemaRegistry.get(config.type!).class;
        req[QUERY_SCHEMA] = req[QUERY_SCHEMA] || {};
        const exploded = BindUtil.expandPaths(req.query);
        req[QUERY_SCHEMA][config.name!] = await getSchemaInstance(config.key ? exploded[config.key] : exploded, cls!, config.view!);
      } :
      async (req: Request) => {
        const cls = SchemaRegistry.get(config.type!).class;
        req.body = await getSchemaInstance(req.body, cls, config.view);
      },
    extract: EXTRACTORS[location]
  };
}

/** @augments trv/rest/Param */
export function SchemaBody<T>(config: Partial<ParamConfig> & { view?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('body', config), idx);
  };
}

/** @augments trv/rest/Param */
export function SchemaQuery<T>(config: Partial<ParamConfig> & { view?: string, key?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('query', config), idx);
  };
}