import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';

import { Request, Response } from '../types';

import { RestInterceptor } from './types';
import { SerializeInterceptor } from './serialize';
import { ManagedConfig, ManagedInterceptor } from './decorator';

/**
 * Rest cors support
 */
@Config('rest.cors')
export class RestCorsConfig extends ManagedConfig {
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
@ManagedInterceptor()
export class CorsInterceptor implements RestInterceptor {

  @Inject()
  config: RestCorsConfig;

  origins: Set<string>;
  methods: string;
  headers: string;
  credentials: boolean = false;

  after = [SerializeInterceptor];

  postConstruct(): void {
    this.origins = new Set(this.config.origins ?? []);
    this.methods = (this.config.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH', 'HEAD', 'TRACE']).join(',');
    this.headers = (this.config.headers ?? []).join(',');
    this.credentials = !!this.config.credentials;
  }

  intercept(req: Request, res: Response): void {
    const origin = req.header('origin');
    if (!this.origins.size || (origin && this.origins.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', `${this.credentials}`);
      res.setHeader('Access-Control-Allow-Methods', this.methods.toUpperCase());
      res.setHeader('Access-Control-Allow-Headers', this.headers || req.header('access-control-request-headers')! || '*');
    }
  }
}