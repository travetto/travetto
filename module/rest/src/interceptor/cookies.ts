import * as cookies from 'cookies';
import { ServerResponse, IncomingMessage } from 'http';

import { Injectable, Inject } from '@travetto/di';

import { RouteConfig, Request, Response } from '../types';
import { RestConfig } from '../config';
import { RestInterceptor } from './interceptor';
import { CorsInterceptor } from './cors';
import { GetCacheInterceptor } from './get-cache';

@Injectable()
export class CookiesInterceptor extends RestInterceptor {

  after = CorsInterceptor;
  before = GetCacheInterceptor;

  @Inject()
  config: RestConfig;

  postConstruct() {
    const self = this.config.cookie;

    // Patch all cookies to default to the cookie values
    const set = cookies.prototype.set;
    const get = cookies.prototype.get;
    cookies.prototype.set = function (key: string, value?: any, opts: any = {}) {
      return set.call(this, key, value, { ...self, ...opts });
    };
    cookies.prototype.get = function (key: string, opts: any = {}) {
      if (key.endsWith('.sig')) {
        opts.secure = false;
      }
      return get.call(this, key, { ...self, ...opts });
    };
  }

  applies(route: RouteConfig) {
    return this.config.cookie.active;
  }

  async intercept(req: Request, res: Response) {
    if (!req.cookies) {
      req.cookies = res.cookies = new cookies(
        req as any as IncomingMessage,
        res as any as ServerResponse,
        this.config.cookie
      );
    }
  }
}