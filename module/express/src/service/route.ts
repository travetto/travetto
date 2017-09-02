import { Request, Response, NextFunction } from 'express';
import { RequestHandler, Filter, FilterPromise, PathType } from '../model';
import { Renderable, Method, ControllerConfig } from '../model';
import { ObjectUtil, toPromise } from '@encore/util';
import { AppService } from './app';
import { Class, DependencyRegistry } from '@encore/di';
import { EventEmitter } from 'events';

export class RouteRegistry {

  private static pendingHandlers = new Map<string, Partial<RequestHandler>[]>();
  private static pendingHandlerMap = new Map<string, Map<Function, Partial<RequestHandler>>>();
  public static controllers = new Map<string, ControllerConfig>();
  public static events = new EventEmitter();

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
        for (let [h, v] of ObjectUtil.toPairs(handler.headers)) {
          if (typeof v === 'string') {
            res.setHeader(h, v);
          } else {
            res.setHeader(h, (v as () => string)());
          }
        }
      }

      await this.render(res, out);
    }

    console.info(`Request`, {
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

    console.error(`Request`, {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      statusCode: status
    });

    console.debug(error);

    // Generally send the error directly to the output
    if (!res.headersSent) {
      res.status(status);
      await this.render(res, error);
    }

    res.end();
  }

  static asyncHandler(filter: FilterPromise, handler?: Filter): FilterPromise {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        let out = await filter(req, res);
        handler ? handler(req, res, out) : next();
      } catch (error) {
        await this.errorHandler(error, req, res);
      }
    };
  }

  static buildPath(base: string, path: PathType | undefined): PathType {
    if (typeof path === 'string') {
      return (base + path).replace(/\/+/, '/').replace(/(.)\/$/, '$1');
    } else if (!!path) {
      return new RegExp('^' + base.replace(/\//g, '\\/') + path.source + '$', path.flags);
    } else {
      return base;
    }
  }

  static getControllerFilters(target: Object) {
    return ((target as any).filters || []) as Filter[];
  }

  static registerControllerFilter(target: Object, fn: Filter) {
    (target as any).filters = ((target as any).filters || []);
    (target as any).filters.push(fn);
  }


  static finalizeClass(config: Partial<ControllerConfig> & { class: Class, path: string }) {

    let clsFilters = this.getControllerFilters(config.class);
    let finalHandlers: RequestHandler[] = [];

    // Merge handler with class's base handler
    for (let handler of this.pendingHandlers.get(DependencyRegistry.getId(config.class))!) {
      let finalHandler = {
        filters: [...clsFilters, ...(handler.filters || [])]
          .map(toPromise).map(f => this.asyncHandler(f as FilterPromise)),

        path: this.buildPath(config.path, handler.path),
        handler: this.asyncHandler(
          toPromise(handler.handler!),
          this.outputHandler.bind(null, handler)
        ),
        method: handler.method,
        class: handler.class,
        headers: handler.headers
      }
      finalHandlers.push(finalHandler as RequestHandler);
    }
    config.handlers = finalHandlers;

    let final = config as ControllerConfig;

    let id = DependencyRegistry.getId(config.class);
    this.pendingHandlers.delete(id);
    this.pendingHandlerMap.delete(id);
    if (this.controllers.has(config.path)) {
      console.log('Reloading controller', config.class.name, config.path);
    }
    this.controllers.set(config.path, final);
    this.events.emit('reload', config)
  }

  static getOrCreateRequestHandlerConfig(cls: Class, handler: Filter) {
    let id = DependencyRegistry.getId(cls);

    if (!this.pendingHandlers.has(id)) {
      this.pendingHandlers.set(id, []);
      this.pendingHandlerMap.set(id, new Map());
    }
    if (!this.pendingHandlerMap.get(id)!.has(handler)) {
      let rh = {
        filters: [],
        class: cls,
        handler: handler,
        headers: {}
      };
      this.pendingHandlerMap.get(id)!.set(handler, rh);
      this.pendingHandlers.get(id)!.push(rh);
    }
    return this.pendingHandlerMap.get(id)!.get(handler)!;
  }

  static registerPendingRequestHandlder(config: Partial<RequestHandler>) {
    return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
      let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
      ObjectUtil.merge(rh, config);
      return descriptor;
    };
  }

  static filterAdder(fn: Filter) {
    return (target: Object, propertyKey?: string, descriptor?: TypedPropertyDescriptor<any>) => {
      if (propertyKey && descriptor) {
        let rh = this.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
        rh.filters!.unshift(fn);
        return descriptor;
      } else { // Class filters
        this.registerControllerFilter(target, fn);
      }
    };
  }
}