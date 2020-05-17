import { Class } from '@travetto/registry';
import { Filter, HeaderMap, RouteConfig, RouteHandler } from '../types';

export interface EndpointClassType {
  type: Class;
  array?: boolean;
  description?: string;
}

export interface EndpointSimpleType {
  mime: string;
  type: string;
}

export type EndpointIOType = EndpointClassType | EndpointSimpleType;

/**
 * Describable elementes
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
  instance?: any;
  /**
   * List of filters to run on request
   */
  filters: Filter[];
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
}

export interface EndpointDecorator<T = any> {
  (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<RouteHandler<T>>): TypedPropertyDescriptor<RouteHandler<T>> | undefined;
}

export interface ControllerDecorator<T = any> {
  (target: Class<T>): Class<T> | undefined;
}