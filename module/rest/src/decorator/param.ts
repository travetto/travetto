import { ClassInstance } from '@travetto/base';

import { ParamConfig } from '../types';
import { ControllerRegistry } from '../registry/controller';
import { ParamUtil } from '../util/param';
import { querySchemaParamConfig } from '../internal/param';

type ParamDecorator = (target: ClassInstance, propertyKey: string | symbol, idx: number) => void;

/**
 * Get the param configuration
 * @param location The location of the parameter
 * @param extra Any additional configuration for the param config
 */
export const paramConfig = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>): ParamConfig => ({
  location,
  ...((typeof extra === 'string' ? { name: extra } : extra))
});

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@trv:rest/Param`
 */
export function Param(location: ParamConfig['location'], extra: string | Partial<ParamConfig>): ParamDecorator {
  const param = paramConfig(location, extra);
  return (target: ClassInstance, propertyKey: string | symbol, idx: number): void => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
}

/**
 * Define a Context param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Context(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('context', param); }
/**
 * Define a Path param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Path(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Query(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export function Header(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The parma configuration
 * @augments `@trv:rest/Param`
 */
export function Body(param: Partial<ParamConfig> = {}): ParamDecorator { return Param('body', param); }

/**
 * Define the query parameters as a schema class
 * @param config The schema configuration
 * @augments `@trv:rest/Param`
 */
export function QuerySchema(config: Partial<ParamConfig> & { view?: string, key?: string } = {}): ParamDecorator {
  return Param('query', querySchemaParamConfig(config));
}

/**
 * Create context provider as a decorator, to allow for adding additional context parameter values
 */
export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
