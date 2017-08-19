import { Request, Response } from 'express';
import { SchemaRegistry, Cls, BindUtil, SchemaValidator } from '../lib';
import { ObjectUtil } from '@encore/util';

import { RouteRegistry, AppError } from '@encore/express';

import * as flat from 'flat';

function getBound<T>(cls: Cls<T>, obj: any, view?: string) {
  try {
    return BindUtil.bindSchema(cls, new cls(), obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatiable with ${cls.name}`);
  }
}

export function SchemaBody<T>(cls: Cls<T>, view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      let o = getBound(cls, req.body, view);
      if (SchemaRegistry.schemas.has(cls)) {
        req.body = await SchemaValidator.validate(o, view);
      } else {
        req.body = o;
      }
    } else {
      throw new AppError(`Body is missing or wrong type: ${req.body}`, 503);
    }
  });
}

export function SchemaQuery<T>(cls: Cls<T>, view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let o = getBound(cls, flat.unflatten(req.query), view);
    if (SchemaRegistry.schemas.has(cls)) {
      req.query = await SchemaValidator.validate(o, view);
    } else {
      req.query = o;
    });
}