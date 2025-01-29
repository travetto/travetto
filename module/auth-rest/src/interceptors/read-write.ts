import { Class } from '@travetto/runtime';
import {
  RestInterceptor, FilterContext, FilterReturn,
  FilterNext, SerializeInterceptor, AsyncContextInterceptor, ParamExtractor
} from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AuthContext, AuthService, Principal } from '@travetto/auth';

import { PrincipalTarget } from '@travetto/auth/src/internal/types';

import { PrincipalCodec } from '../types';
import { RestAuthConfig } from '../config';

const toDate = (v: string | Date | undefined): Date | undefined => (typeof v === 'string') ? new Date(v) : v;

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
  config: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  postConstruct(): void {
    this.codec ??= {
      decode: (ctx): Principal | undefined => this.config.readValue<Principal>(ctx.req),
      encode: (ctx, value): void => this.config.writeValue(ctx.res, value, value?.expiresAt)
    };
  }

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    let decoded: Principal | undefined;
    let checked: Principal | undefined;
    let lastExpiresAt: Date | undefined;

    this.authContext.init();
    Object.defineProperty(ctx.req, 'user', { get: () => this.authContext.principal });

    try {
      decoded = await this.codec.decode(ctx);
      if (decoded) {
        decoded.expiresAt = toDate(decoded.expiresAt);
        decoded.issuedAt = toDate(decoded.issuedAt);
      }

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