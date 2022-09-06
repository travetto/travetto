import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response } from '../types';

import { DisabledConfig, PathAwareConfig, RestInterceptor } from './types';
import { ConfiguredInterceptor } from './decorator';

/**
 * Rest logging configuration
 */
@Config('rest.logRoutes')
export class RestLogRoutesConfig implements DisabledConfig, PathAwareConfig {
  /**
   * Is interceptor disabled
   */
  disabled = false;
  /**
   * Path specific overrides
   */
  paths: string[] = [];
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
@ConfiguredInterceptor()
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
