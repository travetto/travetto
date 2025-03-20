import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { FilterContext } from '../types.ts';
import { MimeUtil } from '../util/mime.ts';

import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { RequestInterceptorGroup } from './groups.ts';

@Config('web.accepts')
class AcceptsConfig extends ManagedInterceptorConfig {
  types: string[] = [];

  @Ignore()
  matcher: (type: string) => boolean;
}

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AcceptsInterceptor implements HttpInterceptor<AcceptsConfig> {

  dependsOn = [RequestInterceptorGroup];

  @Inject()
  config: AcceptsConfig;

  finalizeConfig(cfg: AcceptsConfig): AcceptsConfig {
    cfg.matcher = MimeUtil.matcher(cfg.types ?? []);
    return cfg;
  }

  // Opt-in
  applies(): boolean {
    return false;
  }

  intercept({ req, config }: FilterContext<AcceptsConfig>): void {
    const contentType = req.header('content-type');
    if (!contentType || !config.matcher(contentType)) {
      throw new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' });
    }
  }
}