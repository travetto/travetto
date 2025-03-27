import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Ignore } from '@travetto/schema';

import { HttpChainedContext, HttpRequest } from '../types.ts';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { EndpointConfig } from '../registry/types.ts';
import { HttpPayload } from '../response/payload.ts';

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
      methods: (config.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH', 'HEAD', 'TRACE']).join(',').toUpperCase(),
      headers: (config.headers ?? []).join(','),
      credentials: !!config.credentials,
    };
    return config;
  }

  applies(ep: EndpointConfig, config: CorsConfig): boolean {
    return config.applies;
  }

  decorate(req: HttpRequest, resolved: CorsConfig['resolved'], out: HttpPayload,): HttpPayload {
    const origin = req.getHeader('origin');
    out.headers.set('Access-Control-Allow-Origin', origin || '*');
    out.headers.set('Access-Control-Allow-Credentials', `${resolved.credentials}`);
    out.headers.set('Access-Control-Allow-Methods', resolved.methods);
    out.headers.set('Access-Control-Allow-Headers', resolved.headers || req.getHeader('access-control-request-headers')! || '*');
    return out;
  }

  async filter({ req, config: { resolved }, next }: HttpChainedContext<CorsConfig>): Promise<HttpPayload> {
    try {
      return this.decorate(req, resolved, await next());
    } catch (err) {
      throw this.decorate(req, resolved, HttpPayload.fromCatch(err));
    }
  }
}