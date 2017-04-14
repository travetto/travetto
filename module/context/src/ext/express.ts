import { Context, getStorage } from '../lib/context';
import { Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next?: Function) {
  getStorage().bindEmitter(req);
  getStorage().bindEmitter(res);
  getStorage().run(() => {
    Context.set({ req, res });
    if (next) {
      next();
    }
  });
}