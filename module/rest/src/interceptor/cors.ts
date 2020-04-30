import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';

import { Request, Response, RouteConfig, Method } from '../types';
import { RestInterceptor } from './interceptor';
import { SerializeInterceptor } from './serialize';

@Config('rest.cors')
// TODO: Document
export class RestCorsConfig {
  active: boolean = false;
  origins?: string[];
  methods?: Method[];
  headers?: string[];
  credentials?: boolean;
}

@Injectable()
// TODO: Document
export class CorsInterceptor extends RestInterceptor {

  @Inject()
  corsConfig: RestCorsConfig;

  origins: Set<string>;
  methods: string;
  headers: string;
  credentials: boolean = false;

  after = SerializeInterceptor;

  postConstruct() {
    this.origins = new Set(this.corsConfig.origins ?? []);
    this.methods = (this.corsConfig.methods ?? ['PUT', 'POST', 'GET', 'DELETE', 'PATCH']).join(',');
    this.headers = (this.corsConfig.headers ?? []).join(',');
    this.credentials = !!this.corsConfig.credentials;
  }

  public applies?(route: RouteConfig) {
    return this.corsConfig && this.corsConfig.active;
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