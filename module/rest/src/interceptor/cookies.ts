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

  applies(route: RouteConfig) {
    return route.method === 'get' && this.config.disableGetCache;
  }

  async intercept(req: Request, res: Response) {
    if (!req.cookies) {
      req.cookies = res.cookies = new cookies(
        req as any as IncomingMessage,
        res as any as ServerResponse, {
          keys: this.config.cookieKeys
        });
    }

    const self = this.config.cookie;

    // Patch all cookies to default to the cookie values
    const set = cookies.Cookie.prototype.set;
    const get = cookies.Cookie.prototype.get;
    cookies.Cookie.prototype.set = function (key: string, value?: any, opts: any = {}) {
      return set.call(this, key, value, { ...self, ...opts });
    };
    cookies.Cookie.prototype.get = function (key: string, opts: any = {}) {
      return get.call(this, key, { ...self, ...opts });
    };

    return;
  }
}