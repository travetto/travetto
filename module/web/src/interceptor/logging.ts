import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpContext, HttpRequest, HttpResponse, NextFunction, WebInternal } from '../types.ts';

/**
 * Web logging configuration
 */
@Config('web.log')
export class WebLogConfig {
  /**
   * Should this be turned off by default?
   */
  disabled?: boolean;
  /**
   * Should errors be dumped as full stack traces
   */
  showStackTrace = true;
}

/**
 * Logging interceptor, to show activity for all requests
 */
@Injectable()
export class LoggingInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';

  @Inject()
  config: WebLogConfig;

  logResult(req: HttpRequest, res: HttpResponse, defaultCode: number): void {
    const duration = Date.now() - req[WebInternal].createdDate!;

    const reqLog = {
      method: req.method,
      path: req.path,
      query: { ...req.query },
      params: req.params,
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

  async filter({ req, res }: HttpContext, next: NextFunction): Promise<void> {
    try {
      await next();
      this.logResult(req, res, 200);
    } catch (err) {
      this.logResult(req, res, 500);
      if (this.config.showStackTrace && err instanceof Error) {
        console.error(err.message, { error: err });
      }
    }
  }
}

