import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
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
export class LoggingInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';

  @Inject()
  config: WebLogConfig;

  applies(ep: EndpointConfig, config: WebLogConfig): boolean {
    return config.applies;
  }

  async filter({ req, next }: WebChainedContext): Promise<WebResponse> {
    const createdDate = Date.now();
    const res = await next();
    const duration = Date.now() - createdDate;

    const err = res.body instanceof Error ? res.body : undefined;
    const code = res.context.httpStatusCode ?? (!!err ? 500 : 200);

    const reqLog = {
      method: req.context.httpMethod,
      path: req.context.path,
      query: req.context.httpQuery,
      params: req.context.pathParams,
      statusCode: code,
      duration,
    };

    if (code < 400) {
      console.info('Request', reqLog);
    } else if (code < 500) {
      console.warn('Request', reqLog);
    } else {
      console.error('Request', reqLog);
    }

    if (this.config.showStackTrace && err) {
      console.error(err.message, { error: err });
    }

    return res;
  }
}

