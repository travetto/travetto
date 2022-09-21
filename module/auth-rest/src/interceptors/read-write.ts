import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, FilterNext } from '@travetto/rest';
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

  @Inject()
  encoder: PrincipalEncoder;

  @Inject()
  config: RestAuthConfig;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<FilterReturn> {
    const { req } = ctx;
    let og: Principal | undefined;
    try {
      og = req.auth = await this.encoder.decode(ctx);
      return await next();
    } finally {
      if (og !== req.auth || (req.auth && og && og.expiresAt !== req.auth.expiresAt)) { // If it changed
        await this.encoder.encode(ctx, req.auth);
      }
      req.auth = undefined;
    }
  }
}