import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';

import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';

import { WebConfig } from '../application/config.ts';
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
    const jar = new CookieJar(req.headers.get('Cookie'), config);
    req.getCookie = jar.get.bind(jar);

    const res = await next();
    for (const c of res.getCookies()) { jar.set(c); }
    for (const c of jar.export()) { res.headers.append('Set-Cookie', c); }
    return res;
  }
}