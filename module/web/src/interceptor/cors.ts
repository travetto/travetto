import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { WebChainedContext } from '../types.ts';
import { HTTP_METHODS, HttpMethod, WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { EndpointConfig } from '../registry/types.ts';
import { WebCommonUtil } from '../util/common.ts';

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
  methods?: HttpMethod[];
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

  decorate(request: WebRequest, resolved: CorsConfig['resolved'], response: WebResponse,): WebResponse {
    const origin = request.headers.get('Origin');
    if (resolved.origins.size === 0 || resolved.origins.has(origin!)) {
      for (const [k, v] of [
        ['Access-Control-Allow-Origin', origin || '*'],
        ['Access-Control-Allow-Credentials', `${resolved.credentials}`],
        ['Access-Control-Allow-Methods', resolved.methods],
        ['Access-Control-Allow-Headers', resolved.headers || request.headers.get('Access-Control-Request-Headers') || '*'],
      ]) {
        response.headers.setIfAbsent(k, v);
      }
    }
    return response;
  }

  async filter({ request, config: { resolved }, next }: WebChainedContext<CorsConfig>): Promise<WebResponse> {
    try {
      return this.decorate(request, resolved, await next());
    } catch (err) {
      throw this.decorate(request, resolved, WebCommonUtil.catchResponse(err));
    }
  }
}