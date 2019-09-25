import * as cookies from 'cookies';
import { ServerResponse, IncomingMessage } from 'http';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { RouteConfig, Request, Response } from '../types';
import { RestConfig } from '../config';
import { RestInterceptor } from './interceptor';
import { CorsInterceptor } from './cors';
import { GetCacheInterceptor } from './get-cache';

@Config('rest.cookie')
export class RestCookieConfig implements cookies.SetOption {
  active = true;
  signed = true;
  httpOnly = true;
  sameSite: cookies.SetOption['sameSite'] | 'lax' = 'lax';
  keys = ['default-insecure'];
  secure?: boolean;
  domain?: string;
}

@Injectable()
export class CookiesInterceptor extends RestInterceptor {

  after = CorsInterceptor;
  before = GetCacheInterceptor;

  @Inject()
  cookieConfig: RestCookieConfig;

  @Inject()
  restConfig: RestConfig;

  postConstruct() {
    const self = this.cookieConfig;

    if (this.cookieConfig.secure === undefined) {
      this.cookieConfig.secure = this.restConfig.ssl.active;
    }

    if (this.cookieConfig.domain === undefined) {
      this.cookieConfig.domain = this.restConfig.hostname;
    }


    // Patch all cookies to default to the cookie values
    const set = cookies.prototype.set;
    const get = cookies.prototype.get;
    cookies.prototype.set = function (key: string, value?: any, opts: any = {}) {
      return set.call(this, key, value, { ...self, ...opts });
    };
    cookies.prototype.get = function (key: string, opts: any = {}) {
      if (key.endsWith('.sig')) {
        opts.secure = false;
        opts.signed = false;
      }
      return get.call(this, key, { ...self, ...opts });
    };
  }

  applies(route: RouteConfig) {
    return this.cookieConfig.active;
  }

  intercept(req: Request, res: Response) {
    if (!req.cookies) {
      req.cookies = res.cookies = new cookies(
        req as any as IncomingMessage,
        res as any as ServerResponse,
        this.cookieConfig
      );
    }
  }
}