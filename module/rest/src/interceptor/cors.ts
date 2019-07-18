import { Injectable, Inject } from '@travetto/di';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './interceptor';
import { RestConfig } from '../config';

@Injectable()
export class CorsInterceptor extends RestInterceptor {

  @Inject()
  restConfig: RestConfig;

  origins: Set<string>;
  methods: string;
  headers: string;
  credentials: boolean = false;

  postConstruct() {
    this.origins = new Set(this.restConfig.cors.origins || []);
    this.methods = (this.restConfig.cors.methods || ['PUT', 'POST', 'GET', 'DELETE', 'PATCH']).join(',');
    this.headers = (this.restConfig.cors.headers || []).join(',');
    this.credentials = !!this.restConfig.cors.credentials;
  }

  public applies?(route: RouteConfig) {
    return this.restConfig.cors && this.restConfig.cors.active;
  }

  intercept(req: Request, res: Response) {
    const origin = req.header('origin') as string;
    if (!this.origins.size || this.origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', `${this.credentials}`);
      res.setHeader('Access-Control-Allow-Methods', this.methods);
      res.setHeader('Access-Control-Allow-Headers', this.headers || req.header('access-control-request-headers')! || '*');
    }
  }
}