import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { MimeUtil } from '../util/mime.ts';
import { WebCommonUtil } from '../util/common.ts';

import { WebChainedContext } from '../types/filter.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';

@Config('web.accept')
export class AcceptConfig {
  /**
   * Accepts certain request content types
   */
  applies = false;
  /**
   * The accepted types
   */
  types: string[] = [];

  @Ignore()
  matcher: (type: string) => boolean;
}

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AcceptInterceptor implements WebInterceptor<AcceptConfig> {

  category: WebInterceptorCategory = 'request';

  @Inject()
  config: AcceptConfig;

  finalizeConfig({ config }: WebInterceptorContext<AcceptConfig>): AcceptConfig {
    config.matcher = MimeUtil.matcher(config.types ?? []);
    return config;
  }

  applies({ config }: WebInterceptorContext<AcceptConfig>): boolean {
    return config.applies && !!config.types.length;
  }

  validate(request: WebRequest, config: AcceptConfig): void {
    const contentType = request.headers.get('Content-Type');
    if (!contentType) {
      throw new WebResponse({
        body: new AppError('Content type was not specified', { category: 'data' }),
        context: {
          httpStatusCode: 416
        }
      });
    } else if (!config.matcher(contentType)) {
      throw new WebResponse({
        body: new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' }),
        context: {
          httpStatusCode: 406
        }
      });
    }
  }

  async filter({ request, config, next }: WebChainedContext<AcceptConfig>): Promise<WebResponse> {
    let res: WebResponse | undefined;
    try {
      this.validate(request, config);
      return res = await next();
    } catch (err) {
      throw res = await WebCommonUtil.catchResponse(err);
    } finally {
      res?.headers.setIfAbsent('Accept', config.types.join(','));
    }
  }
}