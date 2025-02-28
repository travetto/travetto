import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { FilterContext, FilterNext } from '../types';
import { RequestLoggingSymbol } from '../symbol.ts
import { SerializeInterceptor } from './serialize';

/**
 * Rest logging configuration
 */
@Config('rest.log')
export class RestLogRoutesConfig extends ManagedInterceptorConfig { }

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  runsBefore = [SerializeInterceptor];

  @Inject()
  config: RestLogRoutesConfig;

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
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
        ...req[RequestLoggingSymbol] ?? {},
        statusCode: res.statusCode,
        duration,
      };

      if (res.statusCode < 400) {
        console.info('Request', reqLog);
      } else if (res.statusCode < 500) {
        console.warn('Request', reqLog);
      } else {
        if (res.statusError) {
          console.error(res.statusError.message, { error: res.statusError });
        }
        console.error('Request', reqLog);
      }
    }
  }
}
