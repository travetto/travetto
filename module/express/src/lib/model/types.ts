import { Request, Response, NextFunction } from 'express';

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options';
export type PathType = string | RegExp;
export interface RequestHandler {
  method?: Method;
  path?: PathType;
  headers?: { [key: string]: (string | (() => string)) };
}
export interface FilterPromise {
  (req: Request, res: Response, next?: NextFunction): Promise<any>;
}
export interface FilterSync {
  (req: Request, res: Response, next?: NextFunction): any;
}
export type Filter = FilterPromise | FilterSync;

