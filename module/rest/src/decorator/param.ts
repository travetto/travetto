import { ClassInstance } from '@travetto/base';
import { BindUtil } from '@travetto/schema';

import { ParamConfig } from '../types';
import { ControllerRegistry } from '../registry/controller';
import { ParamUtil } from '../util/param';

const QuerySchemaⲐ: unique symbol = Symbol.for('@trv:rest/schema-query');

declare global {
  interface TravettoRequest {
    [QuerySchemaⲐ]: Record<string, unknown>;
  }
}

/**
 * Get the param configuration
 * @param location The location of the parameter
 * @param extra Any additional configuration for the param config
 */
export const paramConfig = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => ({
  location, ...(
    (typeof extra === 'string' ? { name: extra } : extra)
  )
}) as ParamConfig;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@trv:rest/Param`
 */
export function Param(location: ParamConfig['location'], extra: string | Partial<ParamConfig>) {
  const param = paramConfig(location, extra);
  return (target: ClassInstance, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
}

/**
 * Define a Context param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Context(param: string | Partial<ParamConfig> = {}) { return Param('context', param); }
/**
 * Define a Path param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Path(param: string | Partial<ParamConfig> = {}) { return Param('path', param); }
/**
 * Define a Query param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Query(param: string | Partial<ParamConfig> = {}) { return Param('query', param); }
/**
 * Define a Header param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Header(param: string | Partial<ParamConfig> = {}) { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The parma configuration
 * @augments `@trv:rest/Param`
 */
export function Body(param: Partial<ParamConfig> = {}) { return Param('body', param); }

/**
 * Define the query parameters as a schema class
 * @param config The schema configuration
 * @augments `@trv:rest/Param`
 */
export function QuerySchema(config: Partial<ParamConfig> & { view?: string, key?: string } = {}) {
  return Param('query', {
    ...config,
    resolve: req => {
      const val = BindUtil.expandPaths(req.query);
      req[QuerySchemaⲐ] ??= {};
      req[QuerySchemaⲐ][config.name!] = config.key ? val[config.key] : val;
    },
    extract: (c, req) => req![QuerySchemaⲐ][c.name!]
  });
}

/**
 * Create context provider as a decorator, to allow for adding additional context parameter values
 */
export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
