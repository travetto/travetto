import * as cookies from 'cookies';
import { ServerResponse, IncomingMessage } from 'http';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { FilterContext, Request, Response } from '../types';
import { RestConfig } from '../application/config';

import { ManagedInterceptorConfig, RestInterceptor } from './types';
import { CorsInterceptor } from './cors';
import { GetCacheInterceptor } from './get-cache';

/**
 * Rest cookie configuration
 */
@Config('rest.cookie')
export class RestCookieConfig extends ManagedInterceptorConfig {
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

class CustomCookies extends cookies {
  #opts: RestCookieConfig;

  constructor(req: Request, res: Response, opts: RestCookieConfig) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    super(req as unknown as IncomingMessage, res as unknown as ServerResponse, opts);
    this.#opts = opts;
  }

  // Patch all cookies to default to the cookie values
  set(key: string, value?: string, opts: cookies.SetOption = {}): this {
    return super.set(key, value, { ...this.#opts, ...opts });
  }

  get(key: string, opts: Partial<cookies.GetOption> & { secure?: boolean } = {}): string | undefined {
    if (key.endsWith('.sig')) {
      opts.secure = false;
      opts.signed = false;
    }
    return super.get(key, { ...this.#opts, ...opts });
  }
}

/**
 * Loads cookies from the request, verifies, exposes, and then signs and sets
 */
@Injectable()
export class CookiesInterceptor implements RestInterceptor<RestCookieConfig> {

  after = [CorsInterceptor];
  before = [GetCacheInterceptor];

  @Inject()
  config: RestCookieConfig;

  @Inject()
  restConfig: RestConfig;

  finalizeConfig(config: RestCookieConfig): RestCookieConfig {
    config.secure ??= this.restConfig.ssl.active;
    config.domain ??= this.restConfig.hostname;
    return config;
  }

  intercept({ req, res, config }: FilterContext<RestCookieConfig>): void {
    // Enforce this is set
    req.cookies = res.cookies = new CustomCookies(req, res, config);
  }
}