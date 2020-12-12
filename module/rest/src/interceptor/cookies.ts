import * as cookies from 'cookies';
import { ServerResponse, IncomingMessage } from 'http';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { RouteConfig, Request, Response } from '../types';
import { RestConfig } from '../server/config';
import { RestInterceptor } from './interceptor';
import { CorsInterceptor } from './cors';
import { GetCacheInterceptor } from './get-cache';

/**
 * Rest cookie configuration
 */
@Config('rest.cookie')
export class RestCookieConfig implements cookies.SetOption {
  /**
   * Are cookies supported
   */
  active = true;
  /**
   * Are they signed
   */
  signed = true;
  /**
   * Supported only via http (not in JS)
   */
  httpOnly = true;
  /**
   * Enforce same site policy
   */
  sameSite: cookies.SetOption['sameSite'] | 'lax' = 'lax';
  /**
   * The signing keys
   */
  keys = ['default-insecure'];
  /**
   * Is the cookie only valid for https
   */
  secure?: boolean;
  /**
   * The domain of the cookie
   */
  domain?: string;
}

/**
 * Loads cookies from the request, verifies, exposes, and then signs and sets
 */
@Injectable()
export class CookiesInterceptor implements RestInterceptor {

  after = [CorsInterceptor];
  before = [GetCacheInterceptor];

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
    // Enforce this is set
    req.cookies = res.cookies = new cookies(
      // @ts-ignore
      req as IncomingMessage,
      // @ts-ignore
      res as ServerResponse,
      this.cookieConfig
    );
  }
}