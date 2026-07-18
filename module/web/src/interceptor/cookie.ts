import { Config } from '@travetto/config';
import { type AsyncContext, AsyncContextValue } from '@travetto/context';
import { Inject, Injectable, PostConstruct } from '@travetto/di';
import { Secret } from '@travetto/schema';

import type { WebConfig } from '../config.ts';
import type { WebAsyncContext } from '../context.ts';
import type { Cookie, CookieSetOptions } from '../types/cookie.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebChainedContext } from '../types/filter.ts';
import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebResponse } from '../types/response.ts';
import { CookieJar } from '../util/cookie.ts';
import { KeyGrip } from '../util/keygrip.ts';

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

  keyGrip: KeyGrip;

  category: WebInterceptorCategory = 'request';

  @Inject()
  config: CookieConfig;

  @Inject()
  webConfig: WebConfig;

  @Inject()
  webAsyncContext: WebAsyncContext;

  @Inject()
  context: AsyncContext;

  @PostConstruct()
  exposeContext(): void {
    this.webAsyncContext.registerSource(CookieJar, () => this.#cookieJar.get());
    this.keyGrip ??= new KeyGrip(this.config.keys ?? []);
  }

  finalizeConfig({ config }: WebInterceptorContext<CookieConfig>): CookieConfig {
    const url = new URL(this.webConfig.baseUrl ?? 'x://localhost');
    config.secure ??= url.protocol === 'https:';
    config.domain ??= url.hostname;
    return config;
  }

  applies({ config }: WebInterceptorContext<CookieConfig>): boolean {
    return config.applies;
  }

  async filter({ request, config, next }: WebChainedContext<CookieConfig>): Promise<WebResponse> {
    const jar = new CookieJar(config, this.keyGrip);
    await jar.importCookieHeader(request.headers.get('Cookie'));
    this.#cookieJar.set(jar);

    const response = await next();
    for (const cookie of await jar.exportSetCookieHeader()) {
      response.headers.append('Set-Cookie', cookie);
    }
    return response;
  }
}
