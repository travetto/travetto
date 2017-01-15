import { Request, Response } from 'express';
import { SchemaRegistry, Cls, BindUtil, SchemaValidator } from '../lib';
import { ObjectUtil } from '@encore/util';

import { RouteRegistry, AppError } from '@encore/express';

let flat = require('flat');

export function SchemaBody<T>(cls: Cls<T>, view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      let o = BindUtil.bindSchema(cls, new cls(), req.body, view);
      if (!!SchemaRegistry.schemas[cls.name]) {
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
    let o = BindUtil.bindSchema(cls, new cls(), flat.unflatten(req.query), view);
    if (!!SchemaRegistry.schemas[cls.name]) {
      req.query = await SchemaValidator.validate(o, view);
    } else {
      req.query = o;
    }
  });
}