import { AppError, Class, Runtime } from '@travetto/runtime';
import {
  RestInterceptor, FilterContext, FilterReturn,
  FilterNext, SerializeInterceptor, AsyncContextInterceptor, ParamExtractor,
  RestCommonUtil
} from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AuthContext, AuthService, Principal } from '@travetto/auth';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';

import { PrincipalTarget } from '@travetto/auth/src/internal/types';

import { PrincipalCodec } from '../types';

const toDate = (v: string | Date | undefined): Date | undefined => (typeof v === 'string') ? new Date(v) : v;

@Config('rest.auth')
export class RestAuthConfig {
  mode: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';
  @Secret()
  signingKey?: string;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.signingKey');
    }
    this.signingKey ??= 'dummy';
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
  config: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  postConstruct(): void {
    this.codec ??= {
      decode: (ctx): Principal | undefined => RestCommonUtil.readValue(this.config, ctx.req),
      encode: (ctx, value): void => RestCommonUtil.writeValue(this.config, ctx.res, value, { expires: value?.expiresAt })
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
        lastExpiresAt = decoded.expiresAt = toDate(decoded.expiresAt);
        decoded.issuedAt = toDate(decoded.issuedAt);
      }

      checked = this.authService.enforceExpiry(decoded);
      this.authContext.principal = checked;

      return await next();
    } finally {
      const result = this.authContext.principal;
      this.authService.manageExpiry(result);

      if ((!!decoded !== !!checked) || result !== checked || lastExpiresAt !== result?.expiresAt) { // If it changed
        await this.codec.encode(ctx, result);
      }

      this.authContext.clear();
    }
  }
}

ParamExtractor.registerContext(PrincipalTarget, (_, req) => req.user);