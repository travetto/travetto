import cookies from 'cookies';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { castTo } from '@travetto/runtime';

import { FilterContext } from '../types';
import { WebConfig } from '../application/config';

import { ManagedInterceptorConfig, WebInterceptor } from './types';
import { SerializeInterceptor } from './serialize';

/**
 * Web cookie configuration
 */
@Config('web.cookie')
export class WebCookieConfig extends ManagedInterceptorConfig {
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
export class CookiesInterceptor implements WebInterceptor<WebCookieConfig> {

  dependsOn = [SerializeInterceptor];

  @Inject()
  config: WebCookieConfig;

  @Inject()
  restConfig: WebConfig;

  finalizeConfig(config: WebCookieConfig): WebCookieConfig {
    config.secure ??= this.restConfig.ssl?.active;
    config.domain ??= this.restConfig.hostname;
    return config;
  }

  intercept({ req, res, config }: FilterContext<WebCookieConfig>): void {
    const store = new cookies(castTo(req), castTo(res), config);
    req.cookies = { get: (key, opts?): string | undefined => store.get(key, { ...this.config, ...opts }) };
    res.cookies = { set: (key, value, opts?): void => { store.set(key, value, { ...this.config, ...opts }); } };
  }
}