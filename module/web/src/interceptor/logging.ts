import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ManagedInterceptorConfig, HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpContext, HttpRequest, HttpResponse, WebInternal } from '../types.ts';
import { RespondInterceptor } from './respond.ts';

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

  category: HttpInterceptorCategory = 'terminal';
  runsBefore = [RespondInterceptor];

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

  async intercept({ req, res, next }: HttpContext): Promise<void> {
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

