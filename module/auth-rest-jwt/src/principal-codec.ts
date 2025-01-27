import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-rest';
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
  authContext: AuthContext;

  /**
   * Encode JWT to response
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    const token = p ? await this.config.signer.create(p) : undefined;
    this.config.value.writeValue(res, token, { expires: p?.expiresAt });
  }

  /**
   * Decode JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = this.config.value.readValue(req);
    if (token) {
      const res = await this.config.signer.verify(token);
      this.authContext.authToken = { type: 'jwt', value: token };
      return res;
    }
  }
}
