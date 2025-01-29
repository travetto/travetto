import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec, RestAuthConfig } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCommonUtil } from '@travetto/rest';

import { RestJWTConfig } from './config';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: RestJWTConfig;

  @Inject()
  restConfig: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  async decode(ctx: FilterContext): Promise<Principal | undefined> {
    const token = RestCommonUtil.readValue(this.restConfig, ctx.req);
    if (token && typeof token === 'string') {
      const out = await this.config.signer.verify(token);
      if (out) {
        this.authContext.authToken = { type: 'jwt', value: token };
      }
      return out;
    }
  }

  async encode(ctx: FilterContext, data: Principal | undefined): Promise<void> {
    const token = data ? await this.config.signer.create(data) : undefined;
    RestCommonUtil.writeValue(this.restConfig, ctx.res, token);
  }
}
