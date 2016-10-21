import { Request, Response, NextFunction } from "express";
import { RequestHandler, Filter, FilterPromise, PathType } from './types';
import { Renderable } from '../model';
import { toPromise } from '../../util';
import { app } from '../initialize';
import { ObjectUtil } from "../../util";

async function outputHandler(handler: RequestHandler, res: Response, out: any) {
  if (!res.headersSent && out) {
    if (handler.headers) {
      (ObjectUtil.toPairs(handler.headers) as [string, string | (() => string)][]).forEach(pair => {
        if (typeof pair[1] === 'string') {
          res.setHeader(pair[0], pair[1] as string)
        } else {
          res.setHeader(pair[0], (pair[1] as () => string)())
        }
      })
    }
    if (out instanceof Renderable) {
      out = (out as Renderable).render(res);
      if (out && out.then) {
        await out;
      }
    } else if (typeof out === 'string') {
      res.send(out);
    } else {
      res.json(out);
    }
  }
  res.end();
}

function errorHandler(res: Response, error: any) {
  console.log(error.stack || error);

  // Generally send the error directly to the output
  if (!res.headersSent) {
    res.status(error.status || error.statusCode || 500);
    res.json(error);
  }

  res.end();
}

function asyncHandler(filter: FilterPromise, handler?: (res: Response, out: any) => void):
  (req: Request, res: Response, next: NextFunction) => Promise<any> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let out = await filter(req, res)
      handler ? handler(res, out) : next();
    } catch (error) {
      errorHandler(res, error);
    }
  }
}

function buildPath(base: string, path: PathType | undefined): PathType {
  if (typeof path === 'string') {
    return (base + path).replace(/\/+/, '/').replace(/(.)\/$/, '$1');
  } else if (!!path) {
    return new RegExp(base + path.source, path.flags);
  } else {
    return base;
  }
}

function registerRequestHandler(fn: Filter, handler: RequestHandler, filters?: Filter[], base: string = '') {
  //Ensure all filters match standard format
  if (handler.method) {
    (app as any)[handler.method].call(app,
      /*url*/ buildPath(base, handler.path),
      /*filters*/ ...(filters || []).map(toPromise).map(f => asyncHandler(f)),
      /*fn*/ asyncHandler(toPromise(fn), outputHandler.bind(null, handler))
    );
  }
}

function registerRequestHandlers(base: string, clz: any) {
  let o = new clz();
  clz.basePath = base;

  Object.getOwnPropertyNames(clz.prototype)
    .filter(k => o[k].requestHandler)
    .forEach(k =>
      registerRequestHandler(
        o[k].bind(o), o[k].requestHandler,
        [...(clz.filters || []), ...(o[k].filters || [])], base))

  return clz;
}

export function Controller(path: string = '') {
  return registerRequestHandlers.bind(null, path);
}