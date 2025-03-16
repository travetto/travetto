import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { FilterContext, FilterNext, HttpRequest, HttpResponse, WebInternal } from '../types.ts';
import { SerializeInterceptor } from './serialize.ts';

/**
 * Web logging configuration
 */
@Config('web.log')
export class WebLogConfig extends ManagedInterceptorConfig {
  showStackTrace = true;
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
    const duration = Date.now() - req[WebInternal].createdDate!;

    const reqLog = {
      method: req.method,
      path: req.path,
      query: { ...req.query },
      params: req.params,
      ...req[WebInternal].requestLogging ?? {},
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

    const err = res[WebInternal].responseError;
    if (this.config.showStackTrace && err) {
      console.error(err.message, { error: err });
    }
  }

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      return await next();
    } finally {
      if (req[WebInternal].requestLogging !== false) {
        this.logResult(req, res);
      }
    }
  }
}
