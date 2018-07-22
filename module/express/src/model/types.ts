import { Request, Response, NextFunction } from 'express';
import { Class } from '@travetto/registry';

export type HeaderMap = { [key: string]: (string | (() => string)) };

export type Method = 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
export type PathType = string | RegExp;
export interface RequestHandler {
  filters?: Filter[];
  method?: Method;
  path?: PathType;
  headers?: HeaderMap;

  class: Class;
  handler: Filter;
  instance?: any;
}

export interface ControllerConfig {
  filters: Filter[];
  path: string;
  class: Class;
  handlers: RequestHandler[];
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
