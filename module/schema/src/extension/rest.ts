// @file-if @travetto/rest
import { ControllerRegistry, Request, ParamConfig, ExtractFn } from '@travetto/rest';
import { Util, AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

import { SchemaRegistry } from '../service/registry';
import { BindUtil } from '../bind-util';
import { SchemaValidator } from '../validate/validator';

const QUERY_SCHEMA: unique symbol = Symbol.for('@trv:schema/rest-query');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Travetto {
    interface Request {
      [QUERY_SCHEMA]: Record<string, any>;
    }
  }
}

const EXTRACTORS: Record<'body' | 'query', ExtractFn> = {
  body: (c, r) => r.body,
  query: (c, r) => r[QUERY_SCHEMA] && r[QUERY_SCHEMA][c.name!]
};

/**
 * Get a schema instance for a class and an object
 * @param obj The object to bind to the class instance
 * @param cls The class to create an instance for
 * @param view The view to bind with
 */
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

/**
 * Get a schema parameter configuration for a class and an object
 * @param location The location for a parameter
 * @param config The field configuration
 */
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

/**
 * Define as the request body as being defined by a schema
 * @param config The schema configuration
 * @augments `@trv:schema/Param`
 * @augments `@trv:rest/Param`
 */
export function SchemaBody<T>(config: Partial<ParamConfig> & { view?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('body', config), idx);
  };
}

/**
 * Define the query parameters as a schema class
 * @param config The schema configuration
 * @augments `@trv:schema/Param`
 * @augments `@trv:rest/Param`
 */
export function SchemaQuery<T>(config: Partial<ParamConfig> & { view?: string, key?: string } = {}) {
  return function (target: any, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('query', config), idx);
  };
}