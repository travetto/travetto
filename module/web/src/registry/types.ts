import type { Any, Class, TypedFunction } from '@travetto/runtime';
import type { SchemaClassConfig, SchemaParameterConfig } from '@travetto/schema';

import type { WebInterceptor } from '../types/interceptor.ts';
import type { WebChainedFilter, WebFilter } from '../types/filter.ts';
import { HttpMethod } from '../types/core.ts';
import { WebHeaders } from '../types/headers.ts';
import { WebResponse, WebResponseContext } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';

export type EndpointFunction = TypedFunction<Any, unknown>;
export type EndpointFunctionDescriptor = TypedPropertyDescriptor<EndpointFunction>;

/**
 * Endpoint decorator for composition of routing logic
 */
export type EndpointDecorator = (
  (<T extends Class>(target: T) => void) &
  (<U>(target: U, prop: string | symbol, descriptor?: EndpointFunctionDescriptor) => void)
);

export type EndpointParamLocation = 'path' | 'query' | 'body' | 'header';

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
  /**
   * Partial response context
   */
  responseContext?: Partial<WebResponseContext>;
}

/**
 * Endpoint parameter configuration
 */
export interface EndpointParameterConfig {
  /**
   * Index of parameter
   */
  index: number;
  /**
   * Location of the parameter
   */
  location: EndpointParamLocation;
  /**
   * Resolves the value by executing with req/res as input
   */
  resolve?: WebFilter;
  /**
   * Extract the value from request
   * @param context The http context with the endpoint param config
   */
  extract?: (ctx: WebRequest, config: EndpointParameterConfig) => unknown;
  /**
   * Input prefix for parameter
   */
  prefix?: string;
}

/**
 * Endpoint configuration
 */
export interface EndpointConfig extends CoreConfig {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * Name of the endpoint (method name)
   */
  methodName: string | symbol;
  /**
   * Instance the endpoint is for
   */
  instance?: unknown;
  /**
   * Method alias for the endpoint
   */
  httpMethod?: HttpMethod;
  /**
   * Is this endpoint cacheable
   */
  cacheable: boolean;
  /**
   * Does this endpoint allow a body
   */
  allowsBody: boolean;
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
  parameters: EndpointParameterConfig[];
  /**
   * Full path including controller
   */
  fullPath: string;
  /**
   * Response finalizer
   */
  responseFinalizer?: (res: WebResponse) => WebResponse;
  /**
   * Response headers finalized
   */
  finalizedResponseHeaders: WebHeaders;
}

/**
 * Controller configuration
 */
export interface ControllerConfig extends CoreConfig {
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
  contextParams: Record<string | symbol, boolean>;
}

/**
 * Controller visitor options
 */
export type ControllerVisitorOptions = { skipPrivate?: boolean };

/**
 * Controller visitor pattern
 */
export interface ControllerVisitor<T = unknown> {

  getOptions?: () => ControllerVisitorOptions;

  onControllerStart?(controller: ControllerConfig): Promise<unknown> | unknown;
  onControllerEnd?(controller: ControllerConfig): Promise<unknown> | unknown;

  onEndpointStart?(endpoint: EndpointConfig, controller: ControllerConfig, methodParams: SchemaParameterConfig[]): Promise<unknown> | unknown;
  onEndpointEnd?(endpoint: EndpointConfig, controller: ControllerConfig, methodParams: SchemaParameterConfig[]): Promise<unknown> | unknown;

  onSchema?(schema: SchemaClassConfig): Promise<unknown> | unknown;

  onControllerAdd?(cls: Class): Promise<unknown> | unknown;
  onControllerRemove?(cls: Class): Promise<unknown> | unknown;

  onSchemaAdd?(cls: Class): Promise<boolean> | boolean;
  onSchemaRemove?(cls: Class): Promise<boolean> | boolean;

  onComplete?(): T | Promise<T>;
}