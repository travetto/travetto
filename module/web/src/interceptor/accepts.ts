import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { MimeUtil } from '../util/mime.ts';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpChainedContext } from '../types.ts';
import { EndpointConfig } from '../registry/types.ts';
import { HttpPayload } from '../response/payload.ts';

@Config('web.accepts')
class AcceptsConfig {
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
export class AcceptsInterceptor implements HttpInterceptor<AcceptsConfig> {

  category: HttpInterceptorCategory = 'request';

  @Inject()
  config: AcceptsConfig;

  finalizeConfig(cfg: AcceptsConfig): AcceptsConfig {
    cfg.matcher = MimeUtil.matcher(cfg.types ?? []);
    return cfg;
  }

  applies(ep: EndpointConfig, config: AcceptsConfig): boolean {
    return config.applies;
  }

  filter({ req, config, next }: HttpChainedContext<AcceptsConfig>): Promise<HttpPayload> {
    const contentType = req.getHeader('content-type');
    if (!contentType || !config.matcher(contentType)) {
      throw new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' });
    }
    return next();
  }
}