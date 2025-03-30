import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { HttpChainedContext } from '../types.ts';
import { HTTP_METHODS, HttpInterceptorCategory } from '../types/core.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpRequest } from '../types/request.ts';
import { HttpInterceptor } from '../types/interceptor.ts';

import { EndpointConfig } from '../registry/types.ts';

const STANDARD_METHODS = Object.values(HTTP_METHODS)
  .filter(x => x.standard && x.method !== 'OPTIONS')
  .map(x => x.method);

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
      methods: (config.methods ?? STANDARD_METHODS).join(',').toUpperCase(),
      headers: (config.headers ?? []).join(','),
      credentials: !!config.credentials,
    };
    return config;
  }

  applies(ep: EndpointConfig, config: CorsConfig): boolean {
    return config.applies;
  }

  decorate(req: HttpRequest, resolved: CorsConfig['resolved'], res: HttpResponse,): HttpResponse {
    const origin = req.headers.get('Origin');
    return res.backfillHeaders({
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': `${resolved.credentials}`,
      'Access-Control-Allow-Methods': resolved.methods,
      'Access-Control-Allow-Headers': resolved.headers || req.headers.get('Access-Control-Request-Headers')! || '*',
    });
  }

  async filter({ req, config: { resolved }, next }: HttpChainedContext<CorsConfig>): Promise<HttpResponse> {
    try {
      return this.decorate(req, resolved, await next());
    } catch (err) {
      throw this.decorate(req, resolved, HttpResponse.fromCatch(err));
    }
  }
}