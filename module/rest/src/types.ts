import { Class } from '@travetto/registry';

export type HeaderMap = { [key: string]: (string | (() => string)) };

export type Method = 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
export type PathType = string | RegExp;

export type Request = Travetto.Request;
export type Response = Travetto.Response;

export interface TypedQuery<T> extends Request { query: T; }
export interface TypedBody<T> extends Request { body: T; }

export type RouteHandler = <T = any>(...args: any[]) => T | Promise<T>;

export type Filter<T = any> = (req: Request, res: Response) => Promise<T> | T | void;

export interface ParamConfig {
  name: string;
  description?: string;
  required?: boolean;
  location: 'path' | 'query' | 'body' | 'header';
  type: Class;
  resolve?: Filter;
}

export interface RouteConfig {
  instance?: any;
  method: Method;
  path: PathType;
  handler: RouteHandler;
  handlerFinalized?: Filter;
  params: ParamConfig[];
}
