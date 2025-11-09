import { EndpointConfig, EndpointFunctionDescriptor } from '../registry/types.ts';
import { HTTP_METHODS, HttpMethod } from '../types/core.ts';
import { ControllerRegistryIndex } from '../registry/registry-index.ts';

type EndpointFunctionDecorator = <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor) => EndpointFunctionDescriptor;

type EndpointDecConfig = Partial<EndpointConfig> & { path: string };

/**
 * Generic Endpoint Decorator
 */
export function Endpoint(config: EndpointDecConfig): EndpointFunctionDecorator {
  return function <T>(target: T, prop: symbol | string, descriptor: EndpointFunctionDescriptor): EndpointFunctionDescriptor {
    ControllerRegistryIndex.getForRegister(target).registerEndpoint(prop, { name: prop }, config);
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
    responseFinalizer: v => {
      v.context.httpStatusCode ??= (v.body === null || v.body === undefined || v.body === '') ? emptyStatusCode : 200;
      return v;
    }
  });
}

/**
 * Registers GET requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Get(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('GET', path); }
/**
 * Registers POST requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Post(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('POST', path); }
/**
 * Registers PUT requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Put(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PUT', path); }
/**
 * Registers PATCH requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:HttpRequestBody`
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Patch(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('PATCH', path); }
/**
 * Registers DELETE requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Delete(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('DELETE', path); }
/**
 * Registers HEAD requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Head(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('HEAD', path); }
/**
 * Registers OPTIONS requests
 * @param path The endpoint path for the request
 * @augments `@travetto/web:Endpoint`
 * @augments `@travetto/schema:Method`
 */
export function Options(path = '/'): EndpointFunctionDecorator { return HttpEndpoint('OPTIONS', path); }
