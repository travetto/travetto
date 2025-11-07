import { toConcrete } from '@travetto/runtime';
import { WebInterceptor, WebAsyncContext, WebInterceptorCategory, WebChainedContext, WebResponse } from '@travetto/web';
import { Injectable, Inject, DependencyRegistryIndex } from '@travetto/di';
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
export class AuthContextInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'application';

  @Inject({ optional: true })
  codec: PrincipalCodec;

  @Inject()
  config: WebAuthConfig;

  @Inject()
  authContext: AuthContext;

  @Inject()
  authService: AuthService;

  @Inject()
  webAsyncContext: WebAsyncContext;

  async postConstruct(): Promise<void> {
    this.codec ??= await DependencyRegistryIndex.getInstance(toConcrete<PrincipalCodec>(), CommonPrincipalCodecSymbol);
    this.webAsyncContext.registerSource(toConcrete<Principal>(), () => this.authContext.principal);
    this.webAsyncContext.registerSource(toConcrete<AuthToken>(), () => this.authContext.authToken);
  }

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    // Skip if already authenticated
    if (this.authContext.principal) {
      return ctx.next();
    }

    try {
      let lastExpiresAt: Date | undefined;
      const decoded = await this.codec.decode(ctx.request);

      if (decoded) {
        lastExpiresAt = decoded.expiresAt = toDate(decoded.expiresAt);
        decoded.issuedAt = toDate(decoded.issuedAt);
      }

      const checked = this.authService.enforceExpiry(decoded);
      this.authContext.principal = checked;
      this.authContext.authToken = await this.codec.token?.(ctx.request);

      let value = await ctx.next();

      const result = this.authContext.principal;
      this.authService.manageExpiry(result);

      if ((!!decoded !== !!checked) || result !== checked || lastExpiresAt !== result?.expiresAt) { // If it changed
        value = await this.codec.encode(value, result);
      }

      return value;
    } finally {
      this.authContext.clear();
    }
  }

}