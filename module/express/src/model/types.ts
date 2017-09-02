import { Request, Response, NextFunction } from 'express';
import { Class } from '@encore/di';

export type Method = 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options';
export type PathType = string | RegExp;
export interface RequestHandler {
  filters?: Filter[];
  method?: Method;
  path?: PathType;
  headers?: { [key: string]: (string | (() => string)) };

  class: Class;
  handler: Filter;
  instance?: any;
}

export interface ControllerConfig {
  path: string;
  class: Class;
  handlers: RequestHandler[];
}

export interface FilterPromise {
  (req: Request, res: Response, next?: NextFunction): Promise<any>;
}
export interface FilterSync {
  (req: Request, res: Response, next?: NextFunction): any;
}
export type Filter = FilterPromise | FilterSync;

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
  }
}
