import { Class } from '@travetto/runtime';
import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, FilterNext, SerializeInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Principal } from '@travetto/auth';
import { Config } from '@travetto/config';

import { PrincipalEncoder } from '../encoder';

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

  dependsOn: Class<RestInterceptor>[] = [SerializeInterceptor];

  @Inject()
  encoder: PrincipalEncoder;

  @Inject()
  config: RestAuthConfig;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    const { req } = ctx;
    let og: Principal | undefined;
    let ogExpires: Date | undefined;
    try {
      og = req.auth = await this.encoder.decode(ctx);
      ogExpires = og?.expiresAt;
      return await next();
    } finally {
      if (req.auth) {
        await this.encoder.preEncode?.(req.auth);
      }
      if (req.auth !== og || ogExpires !== req.auth?.expiresAt) { // If it changed
        await this.encoder.encode(ctx, req.auth);
      }
      req.auth = undefined;
    }
  }
}