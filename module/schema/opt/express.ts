import * as flat from 'flat';
import * as _ from 'lodash';
import { Request, Response } from 'express';

import { RouteRegistry, AppError } from '@travetto/express';
import { Class } from '@travetto/registry';

import { SchemaRegistry, BindUtil, SchemaValidator } from '../src';


function getBound<T>(cls: Class<T>, obj: any, view?: string) {
  try {
    return BindUtil.bindSchema(cls, new cls(), obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatiable with ${cls.name}`);
  }
}

export function SchemaBody<T>(cls: Class<T>, view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    if (_.isPlainObject(req.body)) {
      let o = getBound(cls, req.body, view);
      if (SchemaRegistry.hasClass(cls)) {
        req.body = await SchemaValidator.validate(o, view);
      } else {
        req.body = o;
      }
    } else {
      throw new AppError(`Body is missing or wrong type: ${req.body}`, 503);
    }
  });
}

export function SchemaQuery<T>(cls: Class<T>, view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let o = getBound(cls, flat.unflatten(req.query), view);
    if (SchemaRegistry.hasClass(cls)) {
      req.query = await SchemaValidator.validate(o, view);
    } else {
      req.query = o;
    }
  });
}