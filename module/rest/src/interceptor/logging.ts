import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './interceptor';
import { ControllerConfig } from '../registry/types';

interface RouteCheck {
  sub: string | RegExp;
  base: string;
}

/**
 * Rest logging configuration
 */
@Config('rest.logRoutes')
export class RestLogRoutesConfig {
  /**
   * List of routes to allow
   */
  allow: string[] = [];
  /**
   * List of routes to deny
   */
  deny: string[] = [];

  /**
   * Allow as a list of route checks
   */
  allowList: RouteCheck[];
  /**
   * Deny as a list of route checks
   */
  denyList: RouteCheck[];

  /**
   * Clean a list of routes into route checks
   * @param arr The list of routes as strings
   */
  clean(arr: string[]) {
    return arr.map(x => x.split(':')).map(([base, sub]) => {
      let final: string | RegExp = sub || '*';
      base = base.replace(/^\/+/, '');
      if (final.includes('*')) {
        final = new RegExp(`^${final.replace(/[*]/g, '.*')}`);
      }
      return { base, sub: final };
    });
  }

  postConstruct() {
    this.allowList = this.clean(this.allow);
    this.denyList = this.clean(this.deny);
  }
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor extends RestInterceptor {

  static matchRoute(controller: Partial<ControllerConfig>, route: RouteConfig, paths: RouteCheck[]) {
    return paths.some(({ base, sub }) => {
      if (base === (controller.basePath ?? '').replace(/^\/+/, '') || base === '*') {
        if (!sub || sub === '*') {
          return true;
        } else if (typeof route.path === 'string') {
          if (typeof sub === 'string') {
            return route.path === sub;
          } else {
            return sub.test(route.path);
          }
        }
      }
    });
  }

  @Inject()
  logConfig: RestLogRoutesConfig;

  applies(route: RouteConfig, controller: Partial<ControllerConfig>) {
    const check = this.logConfig.deny.length ?
      !LoggingInterceptor.matchRoute(controller, route, this.logConfig.denyList) :
      (this.logConfig.allow.length ?
        LoggingInterceptor.matchRoute(controller, route, this.logConfig.allowList) : true);

    return check;
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const start = Date.now();

    try {
      return await next();
    } finally {
      const duration = Date.now() - start;

      const reqLog = {
        method: req.method,
        path: req.baseUrl ? `${req.baseUrl}${req.path}`.replace(/\/+/, '/') : req.path,
        query: req.query,
        params: req.params,
        statusCode: res.statusCode,
        duration
      };

      if (reqLog.statusCode < 400) {
        console.info(`Request`, reqLog);
      } else {
        console.error(`Request`, reqLog);
      }
    }
  }
}
