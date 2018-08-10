import { Application, Request, Response, NextFunction } from 'express';
import { Class } from '@travetto/registry';

export type HeaderMap = { [key: string]: (string | (() => string)) };

export type Method = 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
export type PathType = string | RegExp;

export interface DescribableConfig {
  title?: string;
  description?: string;
}

export interface ParamConfig {
  name: string;
  description?: string;
  required?: boolean;
  location: 'path' | 'query' | 'body';
  type?: Class;
}

interface CoreConfig {
  class: Class;
  instance?: any;

  filters: Filter[];
  headers: HeaderMap;
}

export interface EndpointIOType {
  type: Class;
  wrapper?: Class;
  description?: string;
}

export interface EndpointConfig extends CoreConfig, DescribableConfig {
  id: string;
  path: PathType;
  priority: number;
  method: Method;
  handler: Filter;
  handlerName: string;
  params: { [key: string]: ParamConfig };
  responseType?: EndpointIOType;
  requestType?: EndpointIOType;
}

export interface ControllerConfig extends CoreConfig, DescribableConfig {
  basePath: string;
  endpoints: EndpointConfig[];
}

export type Filter<T = any> = (req: Request, res: Response, next?: NextFunction) => T;

export class RouteStack {
  name: string;
  keys: string[];
  regexp: {
    fast_star: boolean,
    fast_slash: boolean
  };
  route: {
    path: string,
    methods: { [key: string]: number },
    stack: RouteStack[]
  };
}

export abstract class ExpressOperator {

  public after?: Class<ExpressOperator>[] | Set<Class<ExpressOperator>> | Class<ExpressOperator>;
  public before?: Class<ExpressOperator>[] | Set<Class<ExpressOperator>> | Class<ExpressOperator>;

  abstract operate(app: Application): void;
}

export class ExpressOperatorSet {
  public operators: Set<Class<ExpressOperator>>;
  constructor(...operators: Class<ExpressOperator>[]) {
    this.operators = new Set(operators);
  }
}