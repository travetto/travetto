import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

import { FilterContext } from '../types.ts';
import { MimeUtil } from '../util/mime.ts';

import { ManagedInterceptorConfig, RestInterceptor } from './types.ts';
import { SerializeInterceptor } from './serialize.ts';

@Config('rest.accepts')
class RestAcceptsConfig extends ManagedInterceptorConfig {
  types: string[] = [];

  @Ignore()
  matcher: (type: string) => boolean;
}

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AcceptsInterceptor implements RestInterceptor<RestAcceptsConfig> {

  dependsOn = [SerializeInterceptor];

  @Inject()
  config: RestAcceptsConfig;

  finalizeConfig(cfg: RestAcceptsConfig): RestAcceptsConfig {
    cfg.matcher = MimeUtil.matcher(cfg.types ?? []);
    return cfg;
  }

  // Opt-in
  applies(): boolean {
    return false;
  }

  intercept({ req, config }: FilterContext<RestAcceptsConfig>): void {
    const contentType = req.header('content-type');
    if (!contentType || !config.matcher(contentType)) {
      throw new AppError(`Content type ${contentType} violated ${config.types.join(', ')}`, { category: 'data' });
    }
  }
}