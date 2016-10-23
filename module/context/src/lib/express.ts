import { Context, Storage } from './context';
import { Request, Response, Express } from 'express';

export function requestContext(req: Request, res: Response, next?: Function) {
  Storage.bindEmitter(req);
  Storage.bindEmitter(res);
  Storage.run(() => {
    Context.set({ req, res });
    if (next) next()
  });
}