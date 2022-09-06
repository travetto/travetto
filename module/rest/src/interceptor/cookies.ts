import * as cookies from 'cookies';
import { ServerResponse, IncomingMessage } from 'http';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { Request, Response } from '../types';
import { RestConfig } from '../application/config';

import { RestInterceptor, DisabledConfig, PathAwareConfig } from './types';
import { CorsInterceptor } from './cors';
import { GetCacheInterceptor } from './get-cache';
import { ConfiguredInterceptor } from './decorator';

/**
 * Rest cookie configuration
 */
@Config('rest.cookie')
export class RestCookieConfig implements DisabledConfig, PathAwareConfig {
  /**
   * Is interceptor disabled
   */
  disabled = false;
  /**
   * Path specific overrides
   */
  paths: string[] = [];
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
@ConfiguredInterceptor()
export class CookiesInterceptor implements RestInterceptor {

  after = [CorsInterceptor];
  before = [GetCacheInterceptor];

  @Inject()
  config: RestCookieConfig;

  @Inject()
  restConfig: RestConfig;

  postConstruct(): void {
    const self = this.config;

    if (this.config.secure === undefined) {
      this.config.secure = this.restConfig.ssl.active;
    }

    if (this.config.domain === undefined) {
      this.config.domain = this.restConfig.hostname;
    }

    // Patch all cookies to default to the cookie values
    const set = cookies.prototype.set;
    const get = cookies.prototype.get;
    cookies.prototype.set = function (key: string, value?: string, opts: cookies.SetOption = {}): cookies.Cookie {
      return set.call(this, key, value, { ...self, ...opts });
    };
    cookies.prototype.get = function (key: string, opts: Partial<cookies.GetOption> & { secure?: boolean } = {}): string | undefined {
      if (key.endsWith('.sig')) {
        opts.secure = false;
        opts.signed = false;
      }
      return get.call(this, key, { ...self, ...opts });
    };
  }

  intercept(req: Request, res: Response): void {
    // Enforce this is set
    req.cookies = res.cookies = new cookies(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      req as unknown as IncomingMessage,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      res as unknown as ServerResponse,
      this.config
    );
  }
}