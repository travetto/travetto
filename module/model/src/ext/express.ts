import { Request, Response } from 'express';
import { bindData } from '../lib/util';
import { BaseModel, Bindable } from '../lib/model';
import { Validator } from '../lib/service';
import { ObjectUtil } from '@encore/util';
let flat = require('flat');

import { RouteRegistry } from '@encore/express';

export function ModelBody<T extends Bindable>(cls: (new (a?: any) => T), view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      let o = bindData(cls, new cls(), req.body, view);
      if (o instanceof BaseModel) {
        req.body = await Validator.validate(o, view);
      } else {
        req.body = o;
      }
    } else {
      throw { message: `Body is missing or wrong type: ${req.body}`, statusCode: 503 };
    }
  });
}

export function ModelQuery<T extends Bindable>(cls: (new (a?: any) => T), view?: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let o = bindData(cls, new cls(), flat.unflatten(req.query), view);
    if (o instanceof BaseModel) {
      req.body = await Validator.validate(o, view);
    } else {
      req.body = o;
    }
  });
}