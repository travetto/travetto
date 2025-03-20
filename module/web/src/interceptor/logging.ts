import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { FilterContext, FilterNext, HttpRequest, HttpResponse, WebInternal } from '../types.ts';
import { ResponseInterceptor } from './response.ts';

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

  runsBefore = [ResponseInterceptor];

  @Inject()
  config: WebLogConfig;

  logResult(req: HttpRequest, res: HttpResponse, defaultCode: number): void {
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

    const code = res.statusCode ?? defaultCode;

    if (code < 400) {
      console.info('Request', reqLog);
    } else if (code < 500) {
      console.warn('Request', reqLog);
    } else {
      console.error('Request', reqLog);
    }
  }

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
    if (req[WebInternal].requestLogging === false) {
      try {
        const value = await next();
        this.logResult(req, res, 200);
        return value;
      } catch (err) {
        this.logResult(req, res, 500);
        if (this.config.showStackTrace) {
          const final = err instanceof Error ? err : AppError.fromBasic(err);
          console.error(final.message, { error: final });
        }
        throw err;
      }
    } else {
      return next();
    }
  }
}

