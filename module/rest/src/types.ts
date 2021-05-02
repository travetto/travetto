import { Class, Closeable } from '@travetto/base';

export type HeaderMap = Record<string, (string | (() => string))>;

export type PathType = string | RegExp;

export type Request = TravettoRequest;
export type Response = TravettoResponse;

export type MethodOrAll = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace' | 'all';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
   * Location of the parameter
   */
  location: 'path' | 'query' | 'body' | 'header' | 'context';
  /**
   * Context type
   */
  contextType?: Class;
  /**
   * Resolves the value by executing with req/res as input
   */
  resolve?: Filter;
  /**
   * Extract the value from request
   * @param config Param configuration
   * @param req The request
   * @param res The response
   */
  extract?(config: ParamConfig, req?: Request, res?: Response): unknown;
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