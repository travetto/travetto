import { Request, Response } from 'express';
import { BaseModel } from '../lib/model';
import { Validator } from '../lib/service';
import { ObjectUtil } from '@encore/util';

import { filterAdder } from '@encore/express';

export function ModelBody<T extends BaseModel>(cls: (new (a?: any) => T), view?: string) {
  return filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      let o = new cls(req.body);
      req.body = await Validator.validate(o, view);
    } else {
      throw { message: `Body is missing or wrong type: ${req.body}`, statusCode: 503 };
    }
  });
}