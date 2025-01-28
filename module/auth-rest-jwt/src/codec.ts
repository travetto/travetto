import { AuthContext, Principal } from '@travetto/auth';
import { CommonPrincipalCodec, PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';

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

  async fromPayload(token: string): Promise<Principal | undefined> {
    const out = await this.config.signer.verify(token);
    if (out) {
      this.authContext.authToken = { type: 'jwt', value: token };
    }
    return out;
  }
}
