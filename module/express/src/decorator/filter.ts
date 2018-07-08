import { Request, Response } from 'express';
import { ControllerRegistry } from '../service';
import { AppError } from '../model';

export function RequiredParam(name: string) {
  return ControllerRegistry.filterAdder(async (req: Request, res: Response) => {
    const param = req.query[name] || req.params[name] || (req.body || {})[name];
    const paramTypes = [
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
  return ControllerRegistry.filterAdder(async (req: Request, res: Response) => {
    const contentType = req.header('content-type') as string;
    if (contentType && contentTypes.indexOf(contentType) < 0) {
      throw new AppError(`Content type ${contentType}`, 400);
    }
  });
}