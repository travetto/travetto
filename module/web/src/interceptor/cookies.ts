import cookies from 'cookies';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { castTo } from '@travetto/runtime';

import { HttpChainedContext } from '../types.ts';
import { WebConfig } from '../application/config.ts';
import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';

/**
 * Web cookie configuration
 */
@Config('web.cookie')
export class CookieConfig {
  /**
   * Should this be turned off by default?
   */
  disabled?: boolean;
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
  @Secret()
  keys?: string[];
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
export class CookiesInterceptor implements HttpInterceptor<CookieConfig> {

  category: HttpInterceptorCategory = 'request';

  @Inject()
  config: CookieConfig;

  @Inject()
  webConfig: WebConfig;

  finalizeConfig(config: CookieConfig): CookieConfig {
    config.secure ??= this.webConfig.ssl?.active;
    config.domain ??= this.webConfig.hostname;
    return config;
  }

  filter({ req, res, config, next }: HttpChainedContext<CookieConfig>): unknown {
    const store = new cookies(castTo(req), castTo(res), config);
    req.cookies = { get: (key, opts?): string | undefined => store.get(key, { ...this.config, ...opts }) };
    res.cookies = { set: (key, value, opts?): void => { store.set(key, value, { ...this.config, ...opts }); } };
    return next();
  }
}