import { Class, ClassInstance } from '@travetto/runtime';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { EndpointParamConfig } from '../registry/types.ts';

type ParamDecorator = (target: ClassInstance, propertyKey: string | symbol, idx: number) => void;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@travetto/web:Param`
 */
export function Param(location: EndpointParamConfig['location'], extra: string | Partial<EndpointParamConfig>): ParamDecorator {
  return (target: ClassInstance, propertyKey: string | symbol, idx: number): void => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistryIndex.getForRegister(target.constructor).registerEndpoint(propertyKey, {
      endpoint: handler,
      params: [{
        index: idx,
        location,
        name: typeof extra === 'string' ? extra : extra.name,
        ...(typeof extra !== 'string' ? extra : {})
      }]
    });
  };
}

/**
 * Define a Path param
 * @param param The param configuration or name
 * @augments `@travetto/web:Param`
 */
export function PathParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The param configuration or name
 * @augments `@travetto/web:Param`
 */
export function QueryParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The param configuration or name
 * @augments `@travetto/web:Param`
 */
export function HeaderParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The param configuration
 * @augments `@travetto/web:Param`
 */
export function Body(param: Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('body', param); }

/**
 * A contextual field as provided by the WebAsyncContext
 * @augments `@travetto/web:ContextParam`
 */
export function ContextParam(config?: { target: Class }) {
  return (inst: unknown, field: string | symbol): void => {
    ControllerRegistryIndex.getForRegister(inst).register({
      contextParams: { [field]: config!.target }
    });
  };
}
