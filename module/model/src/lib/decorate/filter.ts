import { BaseModel } from '../model';
import { ModelValidator } from '../service';
import { ObjectUtil } from "@encore/base";

import { Request, Response } from 'express';
import { filterAdder } from '@encore/express';

export function ModelBody<T extends BaseModel>(cls: (new (a?: any) => T)) {
  return filterAdder(async (req: Request, res: Response) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      try {
        let o = new cls(req.body);
        req.body = await ModelValidator.validate(o);
      } catch (e) {
        console.log(e);
        throw e;
      }
    } else {
      throw { message: `Body is missing or wrong type: ${req.body}`, statusCode: 503 }
    }
  });
}