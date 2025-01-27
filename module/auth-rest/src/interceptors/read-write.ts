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

import { PrincipalCodec } from '../codec';

@Config('rest.auth.readWrite')
export class RestAuthReadWriteConfig extends ManagedInterceptorConfig {

  maxAge: TimeSpan | number = '1h';
  rollingRenew: boolean = false;

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

  @Inject()
  codec: PrincipalCodec;

  @Inject()
  config: RestAuthReadWriteConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    let decoded: Principal | undefined;
    let checked: Principal | undefined;
    let lastExpiresAt: Date | undefined;

    this.authContext.init();
    Object.defineProperty(ctx.req, 'user', { get: () => this.authContext.principal });

    try {
      decoded = await this.codec.decode(ctx);
      checked = this.authService.checkExpiry(decoded);
      lastExpiresAt = checked?.expiresAt;
      this.authContext.principal = checked;
      return await next();
    } finally {
      const current = this.authContext.principal;
      if (current) {
        this.authService.enforceExpiry(current, this.config.maxAgeMs, this.config.rollingRenew);
      }
      if ((!!decoded !== !!checked) || current !== checked || lastExpiresAt !== current?.expiresAt) { // If it changed
        await this.codec.encode(ctx, current);
      }

      this.authContext.clear();
    }
  }
}

ParamExtractor.registerContext(PrincipalTarget, (_, req) => req.user);