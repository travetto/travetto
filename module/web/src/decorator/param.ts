import { ClassInstance } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { EndpointParameterConfig, EndpointParamLocation } from '../registry/types.ts';

type ParamDecorator = (instance: ClassInstance, property: string | symbol, idx: number) => void;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@travetto/schema:Input`
 */
export function Param(location: EndpointParamLocation, extra: string | Partial<EndpointParameterConfig>): ParamDecorator {
  return (instance: ClassInstance, property: string | symbol, idx: number): void => {
    const name = typeof extra === 'string' ? extra : extra.name;
    const config = typeof extra === 'string' ? {} : extra;

    // Set name as needed
    if (name) {
      SchemaRegistryIndex.getForRegister(instance.constructor).registerParameter(property, idx, { name });
    }

    ControllerRegistryIndex.getForRegister(instance.constructor).registerEndpointParameter(property, idx, {
      index: idx, location, ...config
    });
  };
}

/**
 * Define a Path param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function PathParam(param: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('path', param); }
/**
 * Define a Query param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function QueryParam(param: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('query', param); }
/**
 * Define a Header param
 * @param param The param configuration or name
 * @augments `@travetto/schema:Input`
 */
export function HeaderParam(param: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('header', param); }
/**
 * Define a body param as an input
 * @param param The param configuration
 * @augments `@travetto/schema:Input`
 */
export function Body(param: Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('body', param); }

/**
 * A contextual field as provided by the WebAsyncContext
 * @augments `@travetto/schema:Field`
 */
export function ContextParam() {
  return (instance: ClassInstance, property: string | symbol): void => {
    ControllerRegistryIndex.getForRegister(instance.constructor).register({ contextParams: { [property]: true } });
    ControllerRegistryIndex.bindContextParamsOnPostConstruct(instance.constructor);

  };
}
