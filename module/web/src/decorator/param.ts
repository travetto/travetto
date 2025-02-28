import { ClassInstance } from '@travetto/runtime';

import { ParamConfig } from '../types';
import { ControllerRegistry } from '../registry/controller';
import { ParamExtractor } from '../util/param';

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
 * @augments `@travetto/web:Param`
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
 * @augments `@travetto/web:Param`
 */
export function ContextParam(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('context', param); }
/**
 * Define a Path param
 * @param param The parma configuration or name
 * @augments `@travetto/web:Param`
 */
export function PathParam(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The parma configuration or name
 * @augments `@travetto/web:Param`
 */
export function QueryParam(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The parma configuration or name
 * @augments `@travetto/web:Param`
 */
export function HeaderParam(param: string | Partial<ParamConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The parma configuration
 * @augments `@travetto/web:Param`
 */
export function Body(param: Partial<ParamConfig> = {}): ParamDecorator { return Param('body', param); }

/**
 * Create context provider as a decorator, to allow for adding additional context parameter values
 */
export const ContextProvider = ParamExtractor.provider.bind(ParamExtractor);
