import cookies from 'cookies';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { castTo } from '@travetto/runtime';

import { HttpChainedContext } from '../types.ts';
import { WebConfig } from '../application/config.ts';
import { EndpointConfig } from '../registry/types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';

/**
 * Web cookie configuration
 */
@Config('web.cookie')
export class CookieConfig {
  /**
   * Support reading/sending cookies
   */
  applies = true;
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
  secure?: boolean = false;
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

  applies(ep: EndpointConfig, config: CookieConfig): boolean {
    return config.applies;
  }

  async filter({ req, config, next }: HttpChainedContext<CookieConfig>): Promise<HttpResponse> {
    const reqStore = new cookies(castTo(req), castTo({}), this.config);
    req.getCookie = (k, o): string | undefined => reqStore.get(k, { ...this.config, ...o });

    const res = await next();

    // TODO: Fix cookie storage
    const resStore = new cookies(castTo({}), castTo(res), config);
    for (const [k, { value: v, options: o }] of Object.entries(res.getCookies())) {
      resStore.set(k, v, o);
    }
    return res;
  }
}