import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './interceptor';
import { CorsInterceptor } from './cors';

@Config('rest.logRoutes')
export class RestLogRoutesConfig {
  allow: (string | RegExp)[] = [];
  deny: (string | RegExp)[] = [];
}

@Injectable()
export class LoggingInterceptor extends RestInterceptor {

  static matchRoute(route: RouteConfig, paths: (string | RegExp)[]) {
    return paths.some(path => {
      if (typeof path === 'string') {
        if (typeof route.path === 'string') {
          return route.path === path;
        } else {
          return route.path.test(path);
        }
      } else {
        if (route.path instanceof RegExp) {
          return route.path.source === path.source;
        } else {
          return path.test(route.path);
        }
      }
    });
  }

  before = CorsInterceptor;

  @Inject()
  logConfig: RestLogRoutesConfig;

  public applies?(route: RouteConfig) {
    return this.logConfig.deny.length ?
      !LoggingInterceptor.matchRoute(route, this.logConfig.deny) :
      (this.logConfig.allow.length ?
        LoggingInterceptor.matchRoute(route, this.logConfig.allow) : true);
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const start = Date.now();

    try {
      return await next();
    } finally {
      const duration = Date.now() - start;

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
  }
}
