import { Class } from '@travetto/base';
import { Filter, HeaderMap, RouteConfig } from '../types';

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