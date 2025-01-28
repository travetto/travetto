import { AuthContext, AuthToken, Principal } from '@travetto/auth';
import { CommonPrincipalCodec, PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';

import { RestJWTConfig } from './config';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec extends CommonPrincipalCodec<string> implements PrincipalCodec {

  @Inject()
  config: RestJWTConfig;

  @Inject()
  authContext: AuthContext;

  async toPayload(p: Principal | undefined): Promise<string | undefined> {
    return p ? await this.config.signer.create(p) : undefined;
  }

  fromPayload(token: string): Promise<Principal | undefined> {
    return this.config.signer.verify(token);
  }

  getToken(ctx: FilterContext): Promise<AuthToken | undefined> | AuthToken | undefined {
    const token = this.readValue(ctx.req);
    return token ? { type: 'jwt', value: token } : undefined;
  }
}
