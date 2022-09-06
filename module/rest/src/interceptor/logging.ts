import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response } from '../types';

import { RestInterceptor } from './types';
import { ManagedConfig, ManagedInterceptor } from './decorator';

/**
 * Rest logging configuration
 */
@Config('rest.logRoutes')
export class RestLogRoutesConfig extends ManagedConfig { }

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
@ManagedInterceptor()
export class LoggingInterceptor implements RestInterceptor {

  @Inject()
  config: RestLogRoutesConfig;

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
