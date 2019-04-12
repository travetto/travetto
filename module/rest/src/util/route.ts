import { AppError, Util } from '@travetto/base';
import { Class } from '@travetto/registry';

import { MimeType } from './mime';
import { HeaderMap, Request, Response, Filter, RouteConfig } from '../types';
import { isRenderable } from '../response/renderable';
import { EndpointConfig, ControllerConfig } from '../registry/types';
import { RestInterceptor } from '../interceptor/interceptor';

const fieldMapping: { [key: string]: 'params' | 'query' | 'body' | 'headers' } = {
  path: 'params',
  query: 'query',
  body: 'body',
  header: 'headers'
};

export class RouteUtil {

  static parseParam(type: Class | undefined, name: string, param: any) {
    try {
      switch (type) {
        case Date: return Util.coerceType(param, new Date());
        case Boolean: return Util.coerceType(param, true);
        case Number: return Util.coerceType(param, 0);
        case String:
        case undefined: return `${param}`;
      }
    } catch (e) {
      throw new AppError(`Incorrect field type for ${name}, ${param} is not a ${type!.name}`, 'data');
    }
  }

  static logRequest(req: Request, res: Response, duration: number) {
    const reqLog = {
      meta: {
        method: req.method,
        path: req.baseUrl ? `${req.baseUrl}${req.path}`.replace(/\/+/, '/') : req.path,
        query: req.query,
        params: req.params,
        statusCode: res.statusCode,
        duration
      }
    };

    if (reqLog.meta.statusCode < 400) {
      console.info(`Request`, reqLog);
    } else {
      console.error(`Request`, reqLog);
    }
  }

  static async sendOutput(req: Request, res: Response, output: any, headers?: HeaderMap) {
    if (!res.headersSent) {
      if (headers) {
        for (const [h, v] of Object.entries(headers)) {
          res.setHeader(h, typeof v === 'string' ? v : v());
        }
      }

      if (output) {
        if (isRenderable(output)) {
          await output.render(res);
        } else if (typeof output === 'string') {
          res.setHeader('Content-Type', MimeType.TEXT);
          res.send(output);
        } else if ('toJSON' in output) {
          res.setHeader('Content-Type', MimeType.JSON);
          res.send((output as any).toJSON());
        } else {
          res.setHeader('Content-Type', MimeType.JSON);
          res.send(JSON.stringify(output as any, undefined, 'pretty' in req.query ? 2 : 0));
        }
      } else {
        res.status(201);
        res.send('');
      }
    }
  }

  static createFilterChain(filters: (Filter | RestInterceptor['intercept'])[]): Filter<Promise<any>> {
    return function filterChain(req: Request, res: Response, idx: number = filters.length - 1): Promise<any> | any {
      const it = filters[idx];
      const next = idx === 0 ? (x?: any) => x : filterChain.bind(null, req, res, idx - 1);
      if (it.length === 3) {
        return it(req, res, next);
      } else {
        const out = it(req, res);
        return out.then ? out.then(next) : next();
      }
    };
  }

  static async _routeHandler(filterChain: Filter, headers: HeaderMap, req: Request, res: Response) {
    const start = Date.now();
    try {
      const output = await filterChain(req, res);
      await RouteUtil.sendOutput(req, res, output, headers);
    } catch (error) {
      if (!(error instanceof Error)) {  // Ensure we always throw "Errors"
        error = new AppError(error.message || 'Unexpected error', 'general', error);
      }
      await RouteUtil.sendOutput(req, res, error);
    } finally {
      RouteUtil.logRequest(req, res, Date.now() - start);
    }
  }

  static computeRouteParams(route: RouteConfig, req: Request, res: Response) {
    const params: any[] = [];
    for (const { name, required, type, location, defaultValue } of route.params) {
      switch (location) {
        case 'request': params.push(req); break;
        case 'response': params.push(res); break;
        case 'body': params.push(req.body); break;
        default:
          const finalLoc = fieldMapping[location];
          const param = req[finalLoc][name!];

          if (required && !param) {
            throw new AppError(`Missing field: ${name}`, 'data');
          } else if (param) {
            params.push(this.parseParam(type, name!, param));
          } else {
            params.push(defaultValue);
          }
      }
    }
    return params;
  }

  static createRouteHandler(
    interceptors: RestInterceptor[],
    route: RouteConfig | EndpointConfig,
    router: Partial<ControllerConfig> = {}): Filter<any> {

    const handlerBound = async (req: Request, res: Response) => {
      const params = this.computeRouteParams(route, req, res);
      return route.handler.apply(route.instance, params);
    };

    const filters: Filter[] = [
      ...(router.filters || []).map(x => x.bind(router.instance)),
      ...('filters' in route ? route.filters : []).map(x => x.bind(route.instance)),
      ...(route.params.filter(x => x.resolve).map(x => x.resolve!))
    ];

    const headers = {
      ...(router.headers || {}),
      ...('headers' in route ? route.headers : {})
    };

    const filterChain = this.createFilterChain([
      ...interceptors
        .filter(x => x.applies ? x.applies(route) : true)
        .map(x => x.intercept.bind(x)),
      ...filters,
      handlerBound
    ].reverse());

    return this._routeHandler.bind(this, filterChain, headers);
  }
}