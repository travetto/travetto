import { toConcrete, Class } from '@travetto/runtime';
import { HttpInterceptor, FilterContext, FilterReturn, FilterNext, SerializeInterceptor, AsyncContextInterceptor, WebContext } from '@travetto/web';
import { Injectable, Inject, DependencyRegistry } from '@travetto/di';
import { AuthContext, AuthService, AuthToken, Principal } from '@travetto/auth';

import { CommonPrincipalCodecSymbol, PrincipalCodec } from '../types.ts';

import { WebAuthConfig } from '../config.ts';

const toDate = (v: string | Date | undefined): Date | undefined => (typeof v === 'string') ? new Date(v) : v;

/**
 * Auth Context interceptor
 *
 * - Supports the ability to encode context via response and decode via the request.
 * - Connects the principal to the AuthContext
 * - Manages expiry checks/extensions
 */
@Injectable()
export class AuthContextInterceptor implements HttpInterceptor {

  dependsOn: Class<HttpInterceptor>[] = [SerializeInterceptor, AsyncContextInterceptor];

  @Inject({ optional: true })
  codec: PrincipalCodec;

  @Inject()
  config: WebAuthConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  @Inject()
  webContext: WebContext;

  async postConstruct(): Promise<void> {
    this.codec ??= await DependencyRegistry.getInstance(toConcrete<PrincipalCodec>(), CommonPrincipalCodecSymbol);
    this.webContext.registerType(toConcrete<Principal>(), () => this.authContext.principal);
    this.webContext.registerType(toConcrete<AuthToken>(), () => this.authContext.authToken);
  }

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    let decoded: Principal | undefined;
    let checked: Principal | undefined;
    let lastExpiresAt: Date | undefined;

    try {
      decoded = await this.codec.decode(ctx);

      if (decoded) {
        lastExpiresAt = decoded.expiresAt = toDate(decoded.expiresAt);
        decoded.issuedAt = toDate(decoded.issuedAt);
      }

      checked = this.authService.enforceExpiry(decoded);
      this.authContext.principal = checked;
      this.authContext.authToken = await this.codec.token?.(ctx);

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