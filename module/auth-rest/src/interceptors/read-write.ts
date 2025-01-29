import { Class } from '@travetto/runtime';
import {
  RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn,
  FilterNext, SerializeInterceptor, AsyncContextInterceptor, ParamExtractor
} from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AuthContext, AuthService, Principal } from '@travetto/auth';
import { Config } from '@travetto/config';

import { PrincipalTarget } from '@travetto/auth/src/internal/types';

import { PrincipalCodec } from '../types';
import { CommonPrincipalCodec } from '../codec';

@Config('rest.auth.readWrite')
export class RestAuthReadWriteConfig extends ManagedInterceptorConfig {
  mode?: 'cookie' | 'header';
  header?: string;
  cookie?: string;
  headerPrefix?: string;
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
    this.codec ??= new CommonPrincipalCodec();
    if (this.codec instanceof CommonPrincipalCodec) {
      this.codec.init(this.config);
    }
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

      checked = this.authService.enforceExpiry(decoded);
      this.authContext.principal = checked;

      return await next();
    } finally {
      this.authService.manageExpiry();

      const result = this.authContext.principal;
      if ((!!decoded !== !!checked) || result !== checked || lastExpiresAt !== result?.expiresAt) { // If it changed
        await this.codec.encode(ctx, result);
      }

      this.authContext.clear();
    }
  }
}

ParamExtractor.registerContext(PrincipalTarget, (_, req) => req.user);