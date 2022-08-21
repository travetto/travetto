import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response, RouteConfig } from '../types';
import { ControllerConfig } from '../registry/types';
import { InterceptorUtil } from '../util/interceptor';

import { RestInterceptor } from './types';

/**
 * Rest logging configuration
 */
@Config('rest.logRoutes')
export class RestLogRoutesConfig {
  /**
   * List of routes to enforce
   */
  paths: string[] = [];
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  @Inject()
  logConfig: RestLogRoutesConfig;


  check: (route: RouteConfig, controller: Partial<ControllerConfig>) => boolean;

  postConstruct(): void {
    this.check = InterceptorUtil.buildRouteChecker(this.logConfig.paths);
  }

  applies(route: RouteConfig, controller: Partial<ControllerConfig>): boolean {
    return this.check(route, controller);
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
