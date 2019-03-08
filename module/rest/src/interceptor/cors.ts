import { Injectable, Inject } from '@travetto/di';

import { Request, Response, RouteConfig } from '../types';
import { RestInterceptor } from './types';
import { RestConfig } from '../config';

@Injectable()
export class CorsInterceptor extends RestInterceptor {

  @Inject()
  restConfig: RestConfig;

  origins: Set<string>;
  methods: string;
  headers: string;

  postConstruct() {
    if (this.restConfig.cors) {
      this.origins = new Set(this.restConfig.cors.origins || []);
      this.methods = (this.restConfig.cors!.methods || ['*']).join(',');
      this.headers = (this.restConfig.cors!.headers || ['*']).join(',');
    }
  }

  public applies?(route: RouteConfig) {
    return !!this.restConfig.cors && this.restConfig.cors.active;
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    if (this.origins.size) {
      const origin = req.header('origin') as string;
      if (this.origins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        return;
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', this.methods);
    res.setHeader('Access-Control-Allow-Headers', this.headers);
    await next();
  }
}