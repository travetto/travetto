import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { HttpContext, HttpRequest } from '../types.ts';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';

/**
 * Web cors support
 */
@Config('web.cors')
export class CorsConfig {
  /**
   * Should this be turned off by default?
   */
  disabled?: boolean;
  /**
   * Allowed origins
   */
  origins?: string[];
  /**
   * Allowed http methods
   */
  methods?: HttpRequest['method'][];
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
export class CorsInterceptor implements HttpInterceptor<CorsConfig> {

  category: HttpInterceptorCategory = 'response';

  @Inject()
  config: CorsConfig;

  finalizeConfig(config: CorsConfig): CorsConfig {
    config.resolved = {
      origins: new Set(config.origins ?? []),
      methods: (config.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH', 'HEAD', 'TRACE']).join(',').toUpperCase(),
      headers: (config.headers ?? []).join(','),
      credentials: !!config.credentials,
    };
    return config;
  }

  filter({ req, res, config: { resolved }, next }: HttpContext<CorsConfig>): unknown {
    const origin = req.header('origin');
    if (!resolved.origins.size || resolved.origins.has('*') || (origin && resolved.origins.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', `${resolved.credentials}`);
      res.setHeader('Access-Control-Allow-Methods', resolved.methods);
      res.setHeader('Access-Control-Allow-Headers', resolved.headers || req.header('access-control-request-headers')! || '*');
    }
    return next();
  }
}