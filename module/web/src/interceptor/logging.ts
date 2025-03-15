import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { FilterContext, FilterNext, HttpRequest, HttpResponse } from '../types.ts';
import { WebSymbols } from '../symbols.ts';
import { SerializeInterceptor } from './serialize.ts';

/**
 * Web logging configuration
 */
@Config('web.log')
export class WebLogConfig extends ManagedInterceptorConfig {
  showStackTrace: boolean;
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements HttpInterceptor {

  runsBefore = [SerializeInterceptor];

  @Inject()
  config: WebLogConfig;

  logResult(req: HttpRequest, res: HttpResponse): void {
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

    if (this.config.showStackTrace) {
      const result = res[WebSymbols.Internal].body;
      if (result instanceof Error) {
        console.error(result.message, { error: result });
      }
    }
  }

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      return await next();
    } finally {
      if (req[WebSymbols.Internal].requestLogging !== false) {
        this.logResult(req, res);
      }
    }
  }
}
