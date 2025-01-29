import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec, RestAuthConfig } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';

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
    const token = this.restConfig.readValue<string>(ctx.req);
    if (token) {
      const out = await this.config.signer.verify(token);
      if (out) {
        this.authContext.authToken = { type: 'jwt', value: token };
      }
      return out;
    }
  }

  async encode(ctx: FilterContext, data: Principal | undefined): Promise<void> {
    const token = data ? await this.config.signer.create(data) : undefined;
    this.restConfig.writeValue<string>(ctx.res, token);
  }
}
