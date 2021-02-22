import { Class, Closeable } from '@travetto/base';

export type HeaderMap = Record<string, (string | (() => string))>;

export type PathType = string | RegExp;

export type Request = TravettoRequest;
export type Response = TravettoResponse;

export type MethodOrAll = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace' | 'all';

export type RouteHandler = (...args: any[]) => any;
export type Filter = (req: Request, res: Response) => any;

export type ServerHandle = Closeable & { on(type: 'close', callback: () => void): unknown | void };

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
  defaultValue?: unknown;
  /**
   * Extract the value from request
   * @param config Param configuration
   * @param req The request
   * @param res The response
   */
  extract(config: ParamConfig, req?: Request, res?: Response): unknown;
}

/**
 * The route configuration
 */
export interface RouteConfig {
  /**
   * Instance the route is for
   */
  instance?: unknown;
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