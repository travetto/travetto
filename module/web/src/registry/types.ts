import type { Class } from '@travetto/runtime';
import type { FieldConfig, ClassConfig } from '@travetto/schema';

import type { HttpInterceptor } from '../interceptor/types.ts';
import type { WebFilter, HttpHandler, HttpHeaderMap, HttpMethodOrAll, HttpRequest, EndpointHandler, HttpResponse } from '../types.ts';

export type EndpointParamExtractor = (config: EndpointParamConfig, req: HttpRequest, res: HttpResponse) => unknown;

/**
 * Endpoint decorator for composition of routing logic
 */
export type EndpointDecorator = (
  (<T extends Class>(target: T) => void) &
  (<U>(target: U, prop: string, descriptor?: TypedPropertyDescriptor<EndpointHandler>) => void)
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
  filters: WebFilter[];
  /**
   * Set of interceptor configs
   */
  interceptors?: [Class<HttpInterceptor>, { disabled?: boolean } & Record<string, unknown>][];
  /**
   * List of headers to add to the response
   */
  headers: HttpHeaderMap;
  /**
   * Should the resource only be used conditionally?
   */
  conditional?: () => (boolean | Promise<boolean>);
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
   * @param config Param configuration
   * @param req The request
   */
  extract?: EndpointParamExtractor;
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
  handlerName: string;
  /**
   * Instance the endpoint is for
   */
  instance?: unknown;
  /**
   * The HTTP method the endpoint is for
   */
  method: HttpMethodOrAll;
  /**
   * The path of the endpoint
   */
  path: string;
  /**
   * The function the endpoint will call
   */
  handler: EndpointHandler;
  /**
   * The compiled and finalized handler
   */
  handlerFinalized?: HttpHandler;
  /**
   * List of params for the endpoint
   */
  params: EndpointParamConfig[];
  /**
   * Endpoint-based interceptor enable/disabling
   */
  interceptors?: [Class<HttpInterceptor>, { disabled?: boolean } & Record<string, unknown>][];
  /**
   * The response type
   */
  responseType?: EndpointIOType;
  /**
   * The request type
   */
  requestType?: EndpointIOType;
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