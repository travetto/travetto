import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { MimeUtil } from '../util/mime.ts';

import { WebChainedContext } from '../types.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';

import { EndpointConfig } from '../registry/types.ts';

@Config('web.accepts')
export class AcceptsConfig {
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
export class AcceptsInterceptor implements WebInterceptor<AcceptsConfig> {

  category: WebInterceptorCategory = 'request';

  @Inject()
  config: AcceptsConfig;

  finalizeConfig(cfg: AcceptsConfig): AcceptsConfig {
    cfg.matcher = MimeUtil.matcher(cfg.types ?? []);
    return cfg;
  }

  applies(ep: EndpointConfig, config: AcceptsConfig): boolean {
    return config.applies;
  }

  filter({ req, config, next }: WebChainedContext<AcceptsConfig>): Promise<WebResponse> {
    const contentType = req.headers.get('Content-Type');
    if (!contentType || !config.matcher(contentType)) {
      throw new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' });
    }
    return next();
  }
}