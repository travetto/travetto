import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './types';
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
  @Ignore()
  allowList: RouteCheck[];
  /**
   * Deny as a list of route checks
   */
  @Ignore()
  denyList: RouteCheck[];

  /**
   * Clean a list of routes into route checks
   * @param arr The list of routes as strings
   */
  clean(arr: string[]): RouteCheck[] {
    return arr.map(x => x.split(':')).map(([base, sub]) => {
      let final: string | RegExp = sub || '*';
      base = base.replace(/^\/+/, '');
      if (final.includes('*')) {
        final = new RegExp(`^${final.replace(/[*]/g, '.*')}`);
      }
      return { base, sub: final };
    });
  }

  postConstruct(): void {
    this.allowList = this.clean(this.allow);
    this.denyList = this.clean(this.deny);
  }
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  static matchRoute(controller: Partial<ControllerConfig>, route: RouteConfig, paths: RouteCheck[]): boolean {
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

  applies(route: RouteConfig, controller: Partial<ControllerConfig>): boolean {
    const check = this.logConfig.deny.length ?
      !LoggingInterceptor.matchRoute(controller, route, this.logConfig.denyList) :
      (this.logConfig.allow.length ?
        LoggingInterceptor.matchRoute(controller, route, this.logConfig.allowList) : true);

    return check;
  }

  async intercept(req: Request, res: Response, next: () => Promise<void | unknown>): Promise<unknown> {
    const start = Date.now();

    try {
      return await next();
    } finally {
      const duration = Date.now() - start;

      const reqLog = {
        method: req.method,
        path: req.path,
        query: { ...req.query },
        params: req.params,
        statusCode: res.statusCode,
        duration
      };

      if (res.statusCode < 400) {
        console.info('Request', reqLog);
      } else if (res.statusCode < 500) {
        console.warn('Request', reqLog);
      } else {
        console.error('Request', reqLog);
      }
    }
  }
}
