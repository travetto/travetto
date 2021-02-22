// @file-if @travetto/schema
import { SchemaRegistry, BindUtil, SchemaValidator } from '@travetto/schema';
import { Class, ClassInstance, Util, AppError } from '@travetto/base';

import { ControllerRegistry } from '../registry/controller';
import { Request, ParamConfig } from '../types';
import { ExtractFn } from '../util/param';

const QuerySchemaSym: unique symbol = Symbol.for('@trv:rest/schema-query');

declare global {
  interface TravettoRequest {
    [QuerySchemaSym]: Record<string, unknown>;
  }
}

const EXTRACTORS: Record<'body' | 'query', ExtractFn> = {
  body: (c, r) => r.body,
  query: (c, r) => r[QuerySchemaSym] && r[QuerySchemaSym][c.name!]
};

/**
 * Get a schema instance for a class and an object
 * @param obj The object to bind to the class instance
 * @param cls The class to create an instance for
 * @param view The view to bind with
 */
export async function getSchemaInstance<T>(obj: T | object, cls: Class<T>, view?: string) {
  if (!Util.isPlainObject(obj)) {
    throw new AppError(`Object is missing or wrong type: ${obj}`, 'data');
  }

  let bound: T;
  try {
    const resolved = SchemaRegistry.get(cls).class; // Get actual class separate from decorator value
    bound = BindUtil.bindSchema(resolved, obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatible with ${cls.ᚕid}: ${e.message}`, 'data');
  }

  if (SchemaRegistry.has(cls)) {
    await SchemaValidator.validate(cls, bound, view);
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
        req[QuerySchemaSym] = req[QuerySchemaSym] || {};
        const exploded = BindUtil.expandPaths(req.query);
        req[QuerySchemaSym][config.name!] = await getSchemaInstance(config.key ? exploded[config.key] : exploded, cls!, config.view!);
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
 * @augments `@trv:rest/Param`
 */
export function SchemaBody(config: Partial<ParamConfig> & { view?: string } = {}) {
  return function (target: ClassInstance, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('body', config), idx);
  };
}

/**
 * Define the query parameters as a schema class
 * @param config The schema configuration
 * @augments `@trv:rest/Param`
 */
export function SchemaQuery(config: Partial<ParamConfig> & { view?: string, key?: string } = {}) {
  return function (target: ClassInstance, prop: string | symbol, idx: number) {
    ControllerRegistry.registerEndpointParameter(target.constructor, target.constructor.prototype[prop],
      schemaParamConfig('query', config), idx);
  };
}