import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './interceptor';
import { SerializeInterceptor } from './serialize';

/**
 * Rest cors support
 */
@Config('rest.cors')
export class RestCorsConfig {
  /**
   * Is cors active
   */
  active: boolean = false;
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
}

/**
 * Interceptor that will provide cors support across all requests
 */
@Injectable()
export class CorsInterceptor implements RestInterceptor {

  @Inject()
  corsConfig: RestCorsConfig;

  origins: Set<string>;
  methods: string;
  headers: string;
  credentials: boolean = false;

  after = [SerializeInterceptor];

  postConstruct() {
    this.origins = new Set(this.corsConfig.origins ?? []);
    this.methods = (this.corsConfig.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH', 'HEAD', 'TRACE']).join(',');
    this.headers = (this.corsConfig.headers ?? []).join(',');
    this.credentials = !!this.corsConfig.credentials;
  }

  applies(route: RouteConfig) {
    return this.corsConfig && this.corsConfig.active;
  }

  intercept(req: Request, res: Response) {
    const origin = req.header('origin') as string;
    if (!this.origins.size || this.origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', `${this.credentials}`);
      res.setHeader('Access-Control-Allow-Methods', this.methods.toUpperCase());
      res.setHeader('Access-Control-Allow-Headers', this.headers || req.header('access-control-request-headers')! || '*');
    }
  }
}