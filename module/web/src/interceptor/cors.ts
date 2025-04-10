import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { WebChainedContext } from '../types.ts';
import { HTTP_METHODS, WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';
import { WebInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';

/**
 * Web cors support
 */
@Config('web.cors')
export class CorsConfig {
  /**
   * Send CORS headers on responses
   */
  applies = true;
  /**
   * Allowed origins
   */
  origins?: string[];
  /**
   * Allowed http methods
   */
  methods?: WebRequest['method'][];
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
export class CorsInterceptor implements WebInterceptor<CorsConfig> {

  category: WebInterceptorCategory = 'response';

  @Inject()
  config: CorsConfig;

  finalizeConfig(config: CorsConfig): CorsConfig {
    config.resolved = {
      origins: new Set(config.origins ?? []),
      methods: (config.methods ?? Object.keys(HTTP_METHODS)).join(',').toUpperCase(),
      headers: (config.headers ?? []).join(','),
      credentials: !!config.credentials,
    };
    return config;
  }

  applies(ep: EndpointConfig, config: CorsConfig): boolean {
    return config.applies;
  }

  decorate(req: WebRequest, resolved: CorsConfig['resolved'], res: WebResponse,): WebResponse {
    const origin = req.headers.get('Origin');
    if (resolved.origins.size === 0 || resolved.origins.has(origin!)) {
      return res.backfillHeaders({
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Credentials': `${resolved.credentials}`,
        'Access-Control-Allow-Methods': resolved.methods,
        'Access-Control-Allow-Headers': resolved.headers || req.headers.get('Access-Control-Request-Headers') || '*',
      });
    } else {
      return res;
    }
  }

  async filter({ req, config: { resolved }, next }: WebChainedContext<CorsConfig>): Promise<WebResponse> {
    try {
      return this.decorate(req, resolved, await next());
    } catch (err) {
      throw this.decorate(req, resolved, WebResponse.fromCatch(err));
    }
  }
}