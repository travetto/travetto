import { Request, Response } from 'express';
import { FilterPromise } from './types';
import { nodeToPromise } from '@encore/base';

export function filterAdder(fn: any) {
  return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    descriptor.value.filters = descriptor.value.filters || []
    descriptor.value.filters.unshift(fn);
    return descriptor;
  };
}

export function RequiredParam(name: string) {
  return filterAdder(async (req: Request, res: Response) => {
    let param = req.query[name] || req.params[name] || (req.body || {})[name]
    let paramTypes = [
      "string",
      "number",
      "object"
    ]

    if ((param !== null) && paramTypes.indexOf(typeof param) == -1) {
      console.log("Required parameter failure");
      throw { "message": `Missing field: ${name}` };
    }
  })
}