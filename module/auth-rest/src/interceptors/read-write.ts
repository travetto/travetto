import { Class } from '@travetto/runtime';
import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, FilterNext, SerializeInterceptor, AsyncContextInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AuthContext, Principal } from '@travetto/auth';
import { Config } from '@travetto/config';

import { PrincipalCodec } from '../codec';

@Config('rest.auth.readWrite')
export class RestAuthConfig extends ManagedInterceptorConfig { }

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
  encoder: PrincipalCodec;

  @Inject()
  config: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    let og: Principal | undefined;
    let ogExpires: Date | undefined;
    // Expose user field on principal
    Object.defineProperty(ctx.req, 'user', { get: () => this.authContext.principal, configurable: false });

    this.authContext.init();

    try {
      og = await this.encoder.decode(ctx);
      ogExpires = og?.expiresAt;
      this.authContext.principal = og;
      return await next();
    } finally {
      const current = this.authContext.principal;
      if (current) {
        await this.encoder.preEncode?.(current);
      }
      if (current !== og || ogExpires !== current?.expiresAt) { // If it changed
        await this.encoder.encode(ctx, current);
      }

      this.authContext.clear();
    }
  }
}