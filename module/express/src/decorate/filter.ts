import { Request, Response } from 'express';
import { RouteRegistry } from '../service';
import { AppError } from '../model';

export function RequiredParam(name: string) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let param = req.query[name] || req.params[name] || (req.body || {})[name];
    let paramTypes = [
      'string',
      'number',
      'object'
    ];

    if ((param !== null) && paramTypes.indexOf(typeof param) === -1) {
      throw new AppError(`Missing field: ${name}`, 400);
    }
  });
}

export function Accepts(contentTypes: string[]) {
  return RouteRegistry.filterAdder(async (req: Request, res: Response) => {
    let contentType = req.header('content-type');
    if (contentType && contentTypes.indexOf(contentType) < 0) {
      throw new AppError(`Content type ${contentType}`, 400);
    }
  });
}