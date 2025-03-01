import { ClassInstance } from '@travetto/runtime';

import { ControllerRegistry } from '../registry/controller';
import { EndpointParamConfig } from '../registry/types';

type ParamDecorator = (target: ClassInstance, propertyKey: string | symbol, idx: number) => void;

/**
 * Get the param configuration
 * @param location The location of the parameter
 * @param extra Any additional configuration for the param config
 */
export const paramConfig = (location: EndpointParamConfig['location'], extra: string | Partial<EndpointParamConfig>): EndpointParamConfig => ({
  location,
  ...((typeof extra === 'string' ? { name: extra } : extra))
});

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@travetto/web:HttpParam`
 */
export function Param(location: EndpointParamConfig['location'], extra: string | Partial<EndpointParamConfig>): ParamDecorator {
  const param = paramConfig(location, extra);
  return (target: ClassInstance, propertyKey: string | symbol, idx: number): void => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
}

/**
 * Define a Context param
 * @param param The parma configuration or name
 * @augments `@travetto/web:HttpParam`
 */
export function ContextParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('context', param); }
/**
 * Define a Path param
 * @param param The parma configuration or name
 * @augments `@travetto/web:HttpParam`
 */
export function PathParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The parma configuration or name
 * @augments `@travetto/web:HttpParam`
 */
export function QueryParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The parma configuration or name
 * @augments `@travetto/web:HttpParam`
 */
export function HeaderParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The parma configuration
 * @augments `@travetto/web:HttpParam`
 */
export function Body(param: Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('body', param); }
