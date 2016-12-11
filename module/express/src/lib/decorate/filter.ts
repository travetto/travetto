import { Request, Response } from 'express';
import { RouteService } from '../service';


export function RequiredParam(name: string) {
  return RouteService.filterAdder(async (req: Request, res: Response) => {
    let param = req.query[name] || req.params[name] || (req.body || {})[name];
    let paramTypes = [
      'string',
      'number',
      'object'
    ];

    if ((param !== null) && paramTypes.indexOf(typeof param) === -1) {
      throw { message: `Missing field: ${name}`, statusCode: 400 };
    }
  });
}