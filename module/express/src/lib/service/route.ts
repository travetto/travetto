import { Request, Response, NextFunction } from 'express';
import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable } from '../model';
import { ObjectUtil, toPromise } from '@encore/util';
import { AppService } from './app';
import { Logger } from '@encore/logging';

export class RouteRegistry {

  static async render(res: Response, out: any) {
    if (out && out.render) {
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

  static async outputHandler(handler: RequestHandler, req: Request, res: Response, out: any) {
    if (!res.headersSent && out) {
      if (handler.headers) {
        (ObjectUtil.toPairs(handler.headers) as [string, string | (() => string)][]).forEach(pair => {
          if (typeof pair[1] === 'string') {
            res.setHeader(pair[0], pair[1] as string);
          } else {
            res.setHeader(pair[0], (pair[1] as () => string)());
          }
        });
      }

      await RouteRegistry.render(res, out);
    }

    Logger.info(`Request`, {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      statusCode: res.statusCode
    });

    res.end();
  }

  static async errorHandler(error: any, req: Request, res: Response, next?: NextFunction) {

    let status = error.status || error.statusCode || 500;

    Logger.error(`Request`, {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      statusCode: status
    });

    Logger.debug(error);

    // Generally send the error directly to the output
    if (!res.headersSent) {
      res.status(status);
      await RouteRegistry.render(res, error);
    }

    res.end();
  }

  static asyncHandler(filter: FilterPromise, handler?: (req: Request, res: Response, out: any) => void):
    (req: Request, res: Response, next: NextFunction) => Promise<any> {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        let out = await filter(req, res);
        handler ? handler(req, res, out) : next();
      } catch (error) {
        await RouteRegistry.errorHandler(error, req, res);
      }
    };
  }

  static buildPath(base: string, path: PathType | undefined): PathType {
    if (typeof path === 'string') {
      return (base + path).replace(/\/+/, '/').replace(/(.)\/$/, '$1');
    } else if (!!path) {
      return new RegExp(base + path.source, path.flags);
    } else {
      return base;
    }
  }

  static registerRequestHandler(fn: Filter, handler: RequestHandler, filters?: Filter[], base = '') {
    // Ensure all filters match standard format
    if (handler.method) {
      AppService.register(handler.method,
        /*url*/ RouteRegistry.buildPath(base, handler.path),
        /*filters*/(filters || []).map(toPromise).map(f => RouteRegistry.asyncHandler(f as FilterPromise)),
        /*fn*/ RouteRegistry.asyncHandler(toPromise(fn), RouteRegistry.outputHandler.bind(null, handler))
      );
    }
  }

  static registerRequestHandlers(base: string, clz: any) {
    let o = new clz();
    clz.basePath = base;

    Object.getOwnPropertyNames(clz.prototype)
      .filter(k => o[k].requestHandler)
      .forEach(k =>
        RouteRegistry.registerRequestHandler(
          o[k].bind(o), o[k].requestHandler,
          [...(clz.filters || []), ...(o[k].filters || [])], base));

    return clz;
  }

  static createRequestHandlerDecorator(rh: RequestHandler) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      descriptor.value.requestHandler =
        ObjectUtil.merge(descriptor.value.requestHandler || {}, rh);
      return descriptor;
    };
  }

  static filterAdder(fn: any) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      descriptor.value.filters = descriptor.value.filters || [];
      descriptor.value.filters.unshift(fn);
      return descriptor;
    };
  }
}