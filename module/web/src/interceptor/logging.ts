import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ManagedInterceptorConfig, HttpInterceptor } from './types';
import { FilterContext, FilterNext, HttpRequest, HttpResponse } from '../types';
import { WebSymbols } from '../symbols';
import { SerializeInterceptor } from './serialize';

/**
 * Web logging configuration
 */
@Config('web.log')
export class WebLogConfig extends ManagedInterceptorConfig { }

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements HttpInterceptor {

  static logResult(req: HttpRequest, res: HttpResponse): void {
    const duration = Date.now() - req[WebSymbols.Internal].createdDate!;

    const reqLog = {
      method: req.method,
      path: req.path,
      query: { ...req.query },
      params: req.params,
      ...req[WebSymbols.Internal].requestLogging ?? {},
      statusCode: res.statusCode,
      duration,
    };

    if (res.statusCode < 400) {
      console.info('Request', reqLog);
    } else if (res.statusCode < 500) {
      console.warn('Request', reqLog);
    } else {
      console.error('Request', reqLog);
    }
  }

  runsBefore = [SerializeInterceptor];

  @Inject()
  config: WebLogConfig;

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      return await next();
    } finally {
      if (req[WebSymbols.Internal].requestLogging !== false) {
        LoggingInterceptor.logResult(req, res);
      }
    }
  }
}
