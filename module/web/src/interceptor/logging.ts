import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';

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

  applies({ config }: WebInterceptorContext<WebLogConfig>): boolean {
    return config.applies;
  }

  async filter({ request, next }: WebChainedContext): Promise<WebResponse> {
    const createdDate = Date.now();
    const response = await next();
    const duration = Date.now() - createdDate;

    const err = response.body instanceof Error ? response.body : undefined;
    const code = response.context.httpStatusCode ??= (!!err ? 500 : 200);

    const logMessage = {
      method: request.context.httpMethod,
      path: request.context.path,
      query: request.context.httpQuery,
      params: request.context.pathParams,
      statusCode: code,
      duration,
    };

    if (code < 400) {
      console.info('Request', logMessage);
    } else if (code < 500) {
      console.warn('Request', logMessage);
    } else {
      console.error('Request', logMessage);
    }

    if (this.config.showStackTrace && err) {
      console.error(err.message, { error: err });
    }

    return response;
  }
}

