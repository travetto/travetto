import { Class } from '@travetto/registry';

export const TRV_RAW = Symbol.for('@trv:rest/raw');
export const TRV_ORIG = Symbol.for('@trv:rest/original');
export const TRV_ADDED_HEADERS: unique symbol = Symbol.for('@trv:rest/headers');


export type HeaderMap = Record<string, (string | (() => string))>;

export type PathType = string | RegExp;

export type Request = Travetto.Request;
export type Response = Travetto.Response;

export type MethodOrAll = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace' | 'all';

export type RouteHandler<T = any> = (...args: any[]) => Promise<T> | T | void;

export type Filter<T = any> = (req: Request, res: Response) => Promise<T> | T | void;

/**
 * Param configuration
 */
export interface ParamConfig {
  /**
   * Name of the parameter
   */
  name?: string;
  /**
   * The description
   */
  description?: string;
  /**
   * Is the parameter required
   */
  required?: boolean;
  /**
   * Location of the parameter
   */
  location: 'path' | 'query' | 'body' | 'header' | 'context';
  /**
   * The type of the parameter
   */
  type: Class;
  /**
   * Is the parameter an array
   */
  array?: boolean;
  /**
   * Resolves the value by executing with req/res as input
   */
  resolve?: Filter;
  /**
   * Default value for the field
   */
  defaultValue?: any;
  /**
   * Extract the value from request
   * @param config Param configuration
   * @param req The request
   * @param res The response
   */
  extract(config: ParamConfig, req?: Request, res?: Response): any;
}

/**
 * The route configuration
 */
export interface RouteConfig {
  /**
   * Instance the route is for
   */
  instance?: any;
  /**
   * The HTTP method the route is for
   */
  method: MethodOrAll;
  /**
   * The path of the route
   */
  path: PathType;
  /**
   * The function the route will call
   */
  handler: RouteHandler;
  /**
   * The compiled and finalized handler
   */
  handlerFinalized?: Filter;
  /**
   * List of params for the route
   */
  params: ParamConfig[];
}