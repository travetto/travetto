import { BaseModel } from '../model';
import { Validator } from '../service';
import { ObjectUtil } from "@encore/util";

import { filterAdder } from '@encore/express';

export function ModelBody<T extends BaseModel>(cls: (new (a?: any) => T)) {
  return filterAdder(async (req, res) => {
    if (ObjectUtil.isPlainObject(req.body)) {
      try {
        let o = new cls(req.body);
        req.body = await Validator.validate(o);
      } catch (e) {
        console.log(e);
        throw e;
      }
    } else {
      throw { message: `Body is missing or wrong type: ${req.body}`, statusCode: 503 }
    }
  });
}