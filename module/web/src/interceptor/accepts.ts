import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { FilterContext } from '../types';
import { MimeUtil } from '../util/mime';

import { ManagedInterceptorConfig, HttpInterceptor } from './types';
import { SerializeInterceptor } from './serialize';

@Config('web.accepts')
class WebAcceptsConfig extends ManagedInterceptorConfig {
  types: string[] = [];

  @Ignore()
  matcher: (type: string) => boolean;
}

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AcceptsInterceptor implements HttpInterceptor<WebAcceptsConfig> {

  dependsOn = [SerializeInterceptor];

  @Inject()
  config: WebAcceptsConfig;

  finalizeConfig(cfg: WebAcceptsConfig): WebAcceptsConfig {
    cfg.matcher = MimeUtil.matcher(cfg.types ?? []);
    return cfg;
  }

  // Opt-in
  applies(): boolean {
    return false;
  }

  intercept({ req, config }: FilterContext<WebAcceptsConfig>): void {
    const contentType = req.header('content-type');
    if (!contentType || !config.matcher(contentType)) {
      throw new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' });
    }
  }
}