import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { AsyncContext, AsyncContextValue } from '@travetto/context';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';

import { WebConfig } from '../config.ts';
import { Cookie, CookieSetOptions } from '../types/cookie.ts';
import { CookieJar } from '../util/cookie.ts';
import { WebAsyncContext } from '../context.ts';

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

  #cookieJar = new AsyncContextValue<CookieJar>(this);

  category: WebInterceptorCategory = 'request';

  @Inject()
  config: CookieConfig;

  @Inject()
  webConfig: WebConfig;

  @Inject()
  webAsyncContext: WebAsyncContext;

  @Inject()
  context: AsyncContext;

  postConstruct(): void {
    this.webAsyncContext.registerType(CookieJar, () => this.#cookieJar.get());
  }

  finalizeConfig({ config }: WebInterceptorContext<CookieConfig>): CookieConfig {
    const url = new URL(this.webConfig.baseUrl ?? 'x://localhost');
    config.secure ??= url.protocol === 'https';
    config.domain ??= url.host;
    return config;
  }

  applies({ config }: WebInterceptorContext<CookieConfig>): boolean {
    return config.applies;
  }

  async filter({ request, config, next }: WebChainedContext<CookieConfig>): Promise<WebResponse> {
    const jar = new CookieJar(request.headers.get('Cookie'), config);
    this.#cookieJar.set(jar);

    const response = await next();
    for (const c of jar.export()) { response.headers.append('Set-Cookie', c); }
    return response;
  }
}