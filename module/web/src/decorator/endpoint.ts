import { ClassInstance, getClass } from '@travetto/runtime';

import { EndpointConfig, EndpointFunctionDescriptor } from '../registry/types.ts';
import { HTTP_METHODS, HttpMethod } from '../types/core.ts';
import { ControllerRegistryIndex } from '../registry/registry-index.ts';

type EndpointFunctionDecorator = <T>(instance: T, property: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

type EndpointDecConfig = Partial<EndpointConfig> & { path: string };

/**
 * Generic Endpoint Decorator
 */
export function Endpoint(config: EndpointDecConfig): EndpointFunctionDecorator {
  return function (instance: ClassInstance, property: symbol | string, descriptor: EndpointFunctionDescriptor): EndpointFunctionDescriptor {
    ControllerRegistryIndex.getForRegister(getClass(instance)).registerEndpoint(property, { methodName: property }, config);
    return descriptor;
  };
}

function HttpEndpoint(method: HttpMethod, path: string): EndpointFunctionDecorator {
  const { body: allowsBody, cacheable, emptyStatusCode } = HTTP_METHODS[method];
  return Endpoint({
    path,
    allowsBody,
    cacheable,
    httpMethod: method,
    responseFinalizer: value => {
      value.context.httpStatusCode ??= (value.body === null || value.body === undefined || value.body === '') ? emptyStatusCode : 200;
      return value;
    }
  });
}

/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Get(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('GET', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Post(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('POST', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Put(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PUT', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Patch(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PATCH', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Delete(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('DELETE', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Head(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('HEAD', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Options(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('OPTIONS', path); }
