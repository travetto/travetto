import { Request, Response } from 'express';
import { bindData } from '../lib/util';
import { BaseModel } from '../lib/model';
import { Validator } from '../lib/service';
import { ObjectUtil } from '@encore/util';

import { RouteRegistry, AppError } from '@encore/express';

let flat = require('flat');

export function ModelBody<T>(cls: (new (a?: any) => T), view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      let o = bindData(cls, new cls(), req.body, view);
      if (o instanceof BaseModel) {
        req.body = await Validator.validate(o, view);
      } else {
        req.body = o;
      }
    } else {
      throw new AppError(`Body is missing or wrong type: ${req.body}`, 503);
    }
  });
}

export function ModelQuery<T>(cls: (new (a?: any) => T), view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let o = bindData(cls, new cls(), flat.unflatten(req.query), view);
    if (o instanceof BaseModel) {
      req.query = await Validator.validate(o, view);
    } else {
      req.query = o;
    }
  });
}