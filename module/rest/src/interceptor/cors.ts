import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { FilterContext, Request } from '../types';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { SerializeInterceptor } from './serialize';

/**
 * Rest cors support
 */
@Config('rest.cors')
export class RestCorsConfig extends ManagedInterceptorConfig {
  /**
   * Allowed origins
   */
  origins?: string[];
  /**
   * Allowed http methods
   */
  methods?: Request['method'][];
  /**
   * Allowed http headers
   */
  headers?: string[];
  /**
   * Support credentials?
   */
  credentials?: boolean;

  @Ignore()
  resolved: {
    origins: Set<string>;
    methods: string;
    headers: string;
    credentials: boolean;
  };
}

/**
 * Interceptor that will provide cors support across all requests
 */
@Injectable()
export class CorsInterceptor implements RestInterceptor<RestCorsConfig> {

  @Inject()
  config: RestCorsConfig;

  after = [SerializeInterceptor];

  finalizeConfig(config: RestCorsConfig): RestCorsConfig {
    config.resolved = {
      origins: new Set(config.origins ?? []),
      methods: (config.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH', 'HEAD', 'TRACE']).join(',').toUpperCase(),
      headers: (config.headers ?? []).join(','),
      credentials: !!config.credentials,
    };
    return config;
  }

  intercept({ req, res, config: { resolved } }: FilterContext<RestCorsConfig>): void {
    const origin = req.header('origin');
    if (!resolved.origins.size || (origin && resolved.origins.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', `${resolved.credentials}`);
      res.setHeader('Access-Control-Allow-Methods', resolved.methods);
      res.setHeader('Access-Control-Allow-Headers', resolved.headers || req.header('access-control-request-headers')! || '*');
    }
  }
}