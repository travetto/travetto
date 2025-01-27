import { Class, TimeSpan, TimeUtil } from '@travetto/runtime';
import {
  RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn,
  FilterNext, SerializeInterceptor, AsyncContextInterceptor, ParamExtractor
} from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AuthContext, AuthService, Principal } from '@travetto/auth';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { PrincipalTarget } from '@travetto/auth/src/internal/types';

import { PrincipalCodec } from '../types';
import { DefaultPrincipalCodec } from '../codec';

@Config('rest.auth.readWrite')
export class RestAuthReadWriteConfig extends ManagedInterceptorConfig {

  maxAge: TimeSpan | number = '1h';
  rollingRenew: boolean = true;

  @Ignore()
  maxAgeMs: number;

  postConstruct(): void {
    this.maxAgeMs = TimeUtil.asMillis(this.maxAge);
  }
}

/**
 * Authentication interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
export class AuthReadWriteInterceptor implements RestInterceptor {

  dependsOn: Class<RestInterceptor>[] = [SerializeInterceptor, AsyncContextInterceptor];

  @Inject({ optional: true })
  codec: PrincipalCodec;

  @Inject()
  config: RestAuthReadWriteConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  postConstruct(): void {
    this.codec ??= new DefaultPrincipalCodec({ cookie: 'default_auth' });
  }

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    let decoded: Principal | undefined;
    let checked: Principal | undefined;
    let lastExpiresAt: Date | undefined;

    this.authContext.init();
    Object.defineProperty(ctx.req, 'user', { get: () => this.authContext.principal });

    try {
      decoded = await this.codec.decode(ctx);
      lastExpiresAt = decoded?.expiresAt;

      checked = this.authService.checkExpiry(decoded);
      this.authContext.principal = checked;

      return await next();
    } finally {
      const result = this.authContext.principal;
      if (result) {
        this.authService.enforceExpiry(result, this.config.maxAgeMs, this.config.rollingRenew);
      }
      if ((!!decoded !== !!checked) || result !== checked || lastExpiresAt !== result?.expiresAt) { // If it changed
        await this.codec.encode(ctx, result);
      }

      this.authContext.clear();
    }
  }
}

ParamExtractor.registerContext(PrincipalTarget, (_, req) => req.user);