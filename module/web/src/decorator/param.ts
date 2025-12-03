import { ClassInstance, getClass } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { EndpointParameterConfig, EndpointParamLocation } from '../registry/types.ts';

type ParamDecorator = (instance: ClassInstance, property: string, idx: number) => void;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Param(location: EndpointParamLocation, aliasOrConfig: string | Partial<EndpointParameterConfig>): ParamDecorator {
  return (instance: ClassInstance, property: string, idx: number): void => {
    const config = typeof aliasOrConfig === 'string' ? {} : aliasOrConfig;
    const cls = getClass(instance);
    if (typeof aliasOrConfig === 'string') {
      SchemaRegistryIndex.getForRegister(cls).registerParameter(property, idx, {
        aliases: [aliasOrConfig] // Register extra input string as an alias
      });
    }

    ControllerRegistryIndex.getForRegister(cls).registerEndpointParameter(property, idx, { location, ...config });
  };
}

/**
 * Define a Path param
 * @input input The param configuration or alias
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function PathParam(input: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('path', input); }
/**
 * Define a Query param
 * @input input The param configuration or alias
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function QueryParam(input: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('query', input); }
/**
 * Define a Header param
 * @input input The param configuration or alias
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function HeaderParam(input: string | Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('header', input); }
/**
 * Define a body param as an input
 * @input input The param configuration
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Body(input: Partial<EndpointParameterConfig> = {}): ParamDecorator { return Param('body', input); }

/**
 * A contextual field as provided by the WebAsyncContext
 * @augments `@travetto/schema:Field`
 * @kind decorator
 */
export function ContextParam() {
  return (instance: ClassInstance, property: string): void => {
    ControllerRegistryIndex.getForRegister(getClass(instance)).register({ contextParams: { [property]: true } });
    ControllerRegistryIndex.bindContextParamsOnPostConstruct(getClass(instance));
  };
}
