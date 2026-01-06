import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { type AsyncContext, AsyncContextValue } from '@travetto/context';

import type { WebChainedContext } from '../types/filter.ts';
import type { WebResponse } from '../types/response.ts';
import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';

import type { WebConfig } from '../config.ts';
import type { Cookie, CookieSetOptions } from '../types/cookie.ts';
import { CookieJar } from '../util/cookie.ts';
import type { WebAsyncContext } from '../context.ts';

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
  signed?: boolean;
  /**
   * Supported only via http (not in JS)
   */
  httponly = true;
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
  secure?: boolean;
  /**
   * The domain of the cookie
   */
  domain?: string;
  /**
   * The default path of the cookie
   */
  path: string = '/';
}

/**
 * Loads cookies from the request, verifies, exposes, and then signs and sets
 */
@Injectable()
export class CookieInterceptor implements WebInterceptor<CookieConfig> {

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
    this.webAsyncContext.registerSource(CookieJar, () => this.#cookieJar.get());
  }

  finalizeConfig({ config }: WebInterceptorContext<CookieConfig>): CookieConfig {
    const url = new URL(this.webConfig.baseUrl ?? 'x://localhost');
    config.secure ??= url.protocol === 'https:';
    config.domain ??= url.hostname;
    config.signed ??= !!config.keys?.length;
    return config;
  }

  applies({ config }: WebInterceptorContext<CookieConfig>): boolean {
    return config.applies;
  }

  async filter({ request, config, next }: WebChainedContext<CookieConfig>): Promise<WebResponse> {
    const jar = new CookieJar(config).importCookieHeader(request.headers.get('Cookie'));
    this.#cookieJar.set(jar);

    const response = await next();
    for (const cookie of jar.exportSetCookieHeader()) { response.headers.append('Set-Cookie', cookie); }
    return response;
  }
}