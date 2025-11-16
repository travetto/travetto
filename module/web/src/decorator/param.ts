import { ClassInstance } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { EndpointParamConfig, EndpointParamLocation } from '../registry/types.ts';

type ParamDecorator = (target: ClassInstance, propertyKey: string | symbol, idx: number) => void;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@travetto/schema:Input`
 */
export function Param(location: EndpointParamLocation, extra: string | Partial<EndpointParamConfig>): ParamDecorator {
  return (target: ClassInstance, propertyKey: string | symbol, idx: number): void => {
    const name = typeof extra === 'string' ? extra : extra.name;
    const config = typeof extra === 'string' ? {} : extra;

    // Set name as needed
    if (name) {
      SchemaRegistryIndex.getForRegister(target).registerParameter(propertyKey, idx, { name });
    }

    ControllerRegistryIndex.getForRegister(target.constructor).registerEndpoint(propertyKey, {
      params: [{ index: idx, location, ...config }]
    });
  };
}

/**
 * Define a Path param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function PathParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function QueryParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function HeaderParam(param: string | Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The param configuration
 * @augments `@travetto/schema:Input`
 */
export function Body(param: Partial<EndpointParamConfig> = {}): ParamDecorator { return Param('body', param); }

/**
 * A contextual field as provided by the WebAsyncContext
 * @augments `@travetto/schema:Field`
 */
export function ContextParam() {
  return (inst: unknown, field: string | symbol): void => {
    ControllerRegistryIndex.getForRegister(inst).register({ contextParams: { [field]: true } });
  };
}
