import { AuthContext, Principal } from '@travetto/auth';
import { CommonPrincipalCodec, PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { JWTSigner } from '@travetto/jwt';

import { RestJWTConfig } from './config';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec extends CommonPrincipalCodec<string> implements PrincipalCodec {

  @Inject()
  _config: RestJWTConfig;

  @Inject()
  authContext: AuthContext;

  signer: JWTSigner<Principal>;

  constructor() {
    super({ header: '_' });
  }

  postConstruct(): void {
    this.signer = new JWTSigner(this._config.signingKey!,
      v => ({
        expiresAt: v.expiresAt!,
        issuedAt: v.issuedAt!,
        issuer: v.issuer!,
        id: v.id,
        sessionId: v.sessionId
      })
    );
    Object.assign(this.config, {
      ...{
        header: undefined!,
        cookie: undefined!,
        headerPrefix: undefined!,
      },
      ...this._config
    });
  }

  async toPayload(p: Principal | undefined): Promise<string | undefined> {
    return p ? await this.signer.create(p) : undefined;
  }

  async fromPayload(token: string): Promise<Principal | undefined> {
    const res = await this.signer.verify(token);
    this.authContext.authToken = { type: 'jwt', value: token };
    return res;
  }
}
