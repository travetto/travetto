import type { Any, Class, TypedFunction } from '@travetto/runtime';
import type { FieldConfig, ClassConfig } from '@travetto/schema';

import type { WebInterceptor } from '../types/interceptor.ts';
import type { WebChainedFilter, WebFilter } from '../types.ts';
import { HttpMethod } from '../types/core.ts';
import { WebpHeaders } from '../types/headers.ts';
import { WebRequest } from '@travetto/web';

export type EndpointFunction = TypedFunction<Any, unknown>;
export type EndpointFunctionDescriptor = TypedPropertyDescriptor<EndpointFunction>;

/**
 * Endpoint decorator for composition of routing logic
 */
export type EndpointDecorator = (
  (<T extends Class>(target: T) => void) &
  (<U>(target: U, prop: string, descriptor?: EndpointFunctionDescriptor) => void)
);

/**
 * Endpoint type
 */
export type EndpointIOType = {
  type: Class;
  array?: boolean;
  description?: string;
};

/**
 * Describable elements
 */
export interface DescribableConfig {
  /**
   * The title
   */
  title?: string;
  /**
   * Description
   */
  description?: string;
  /**
   * Is the resource documented
   */
  documented?: boolean;
}

/**
 * Core configuration for endpoints and controllers
 */
interface CoreConfig {
  /**
   * The related class
   */
  class: Class;
  /**
   * The actual class instance
   */
  instance?: unknown;
  /**
   * List of filters to run on request
   */
  filters: (WebFilter | WebChainedFilter)[];
  /**
   * Set of interceptor configs
   */
  interceptorConfigs?: [Class<WebInterceptor>, unknown][];
  /**
   * Should the resource only be used conditionally?
   */
  conditional?: () => (boolean | Promise<boolean>);
  /**
   * Control which interceptors are excluded
   */
  interceptorExclude?: (val: WebInterceptor) => boolean;
  /**
   * Response headers
   */
  responseHeaders?: Record<string, string>;
}

/**
 * Endpoint param configuration
 */
export interface EndpointParamConfig {
  /**
   * Name of the parameter
   */
  name?: string;
  /**
   * Raw text of parameter at source
   */
  sourceText?: string;
  /**
   * Location of the parameter
   */
  location: 'path' | 'query' | 'body' | 'header';
  /**
   * Resolves the value by executing with req/res as input
   */
  resolve?: WebFilter;
  /**
   * Extract the value from request
   * @param context The http context with the endpoint param config
   */
  extract?: (req: WebRequest, config: EndpointParamConfig) => unknown;
  /**
   * Input prefix for parameter
   */
  prefix?: string;
}

/**
 * Endpoint configuration
 */
export interface EndpointConfig extends CoreConfig, DescribableConfig {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * The name of the method
   */
  name: string;
  /**
   * Instance the endpoint is for
   */
  instance?: unknown;
  /**
   * The HTTP method the endpoint is for
   */
  method: HttpMethod;
  /**
   * The path of the endpoint
   */
  path: string;
  /**
   * The function the endpoint will call
   */
  endpoint: EndpointFunction;
  /**
   * The compiled and finalized handler
   */
  filter?: WebFilter;
  /**
   * List of params for the endpoint
   */
  params: EndpointParamConfig[];
  /**
   * The response type
   */
  responseType?: EndpointIOType;
  /**
   * The request type
   */
  requestType?: EndpointIOType;
  /**
   * Full path including controller
   */
  fullPath: string;
  /**
   * Response header map
   */
  responseHeaderMap: WebpHeaders;
}

/**
 * Controller configuration
 */
export interface ControllerConfig extends CoreConfig, DescribableConfig {
  /**
   * The base path of the controller
   */
  basePath: string;
  /**
   * List of all endpoints
   */
  endpoints: EndpointConfig[];
  /**
   * Client name, used by consuming tools/clients
   */
  externalName: string;
  /**
   * Context parameters to bind at create
   */
  contextParams: Record<string, Class>;
}

/**
 * Controller visitor options
 */
export type ControllerVisitorOptions = { skipUndocumented?: boolean };

/**
 * Controller visitor pattern
 */
export interface ControllerVisitor<T = unknown> {

  getOptions?: () => ControllerVisitorOptions;

  onControllerStart?(controller: ControllerConfig): Promise<unknown> | unknown;
  onControllerEnd?(controller: ControllerConfig): Promise<unknown> | unknown;

  onEndpointStart?(endpoint: EndpointConfig, controller: ControllerConfig, methodParams: FieldConfig[]): Promise<unknown> | unknown;
  onEndpointEnd?(endpoint: EndpointConfig, controller: ControllerConfig, methodParams: FieldConfig[]): Promise<unknown> | unknown;

  onSchema?(schema: ClassConfig): Promise<unknown> | unknown;

  onControllerAdd?(cls: Class): Promise<unknown> | unknown;
  onControllerRemove?(cls: Class): Promise<unknown> | unknown;

  onSchemaAdd?(cls: Class): Promise<boolean> | boolean;
  onSchemaRemove?(cls: Class): Promise<boolean> | boolean;

  onComplete?(): T | Promise<T>;
}