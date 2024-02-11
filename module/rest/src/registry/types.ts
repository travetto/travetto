import type { Class } from '@travetto/base';
import type { FieldConfig, ClassConfig } from '@travetto/schema';

import type { RestInterceptor } from '../interceptor/types';
import type { Filter, HeaderMap, RouteConfig, RouteHandler } from '../types';

/**
 * Endpoint decorator for composition of routing logic
 */
export type EndpointDecorator = (
  (<T extends Class>(target: T) => void) &
  (<U>(target: U, prop: string, descriptor?: TypedPropertyDescriptor<RouteHandler>) => void)
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
  filters: Filter[];
  /**
   * Set of interceptor configs
   */
  interceptors?: [Class<RestInterceptor>, { disabled?: boolean } & Record<string, unknown>][];
  /**
   * List of headers to add to the response
   */
  headers: HeaderMap;
}

/**
 * Endpoint configuration
 */
export interface EndpointConfig extends RouteConfig, CoreConfig, DescribableConfig {
  /**
   * Unique identifier
   */
  id: string;
  /**
   * Endpoint priority, used for conflicting routes
   */
  priority: number;
  /**
   * The name of the method
   */
  handlerName: string;
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
}

/**
 * Controller visitor pattern
 */
export interface ControllerVisitor<T = unknown> {

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