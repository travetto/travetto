import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';

import { WebConfig } from '../config/web.ts';
import { EndpointConfig } from '../registry/types.ts';
import { Cookie, CookieSetOptions } from '../types/cookie.ts';
import { CookieJar } from '../util/cookie.ts';

/**
 * Web cookie configuration
 */
@Config('web.cookie')
export class CookieConfig implements CookieSetOptions {
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
  sameSite: Cookie['sameSite'] = 'lax';
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
export class CookiesInterceptor implements WebInterceptor<CookieConfig> {

  category: WebInterceptorCategory = 'request';

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

  async filter({ req, config, next }: WebChainedContext<CookieConfig>): Promise<WebResponse> {
    const jar = new CookieJar(req.headers.get('Cookie'), config);
    req.getCookie = jar.get.bind(jar);

    const res = await next();
    for (const c of res.getCookies()) { jar.set(c); }
    for (const c of jar.export()) { res.headers.append('Set-Cookie', c); }
    return res;
  }
}