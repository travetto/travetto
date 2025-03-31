import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpInterceptor } from '../types/interceptor.ts';
import { HttpInterceptorCategory } from '../types/core.ts';
import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { EndpointConfig } from '../registry/types.ts';

/**
 * Web logging configuration
 */
@Config('web.log')
export class WebLogConfig {
  /**
   * Enable logging of all requests
   */
  applies = true;
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

  applies(ep: EndpointConfig, config: WebLogConfig): boolean {
    return config.applies;
  }

  async filter({ req, next }: HttpChainedContext): Promise<HttpResponse> {
    const createdDate = Date.now();
    const res = await next();

    const err = res.source instanceof Error ? res.source : undefined;
    const defaultCode = !!err ? 500 : 200;
    const duration = Date.now() - createdDate;

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

    if (this.config.showStackTrace && err instanceof Error) {
      console.error(err.message, { error: err });
    }

    return res;
  }
}

