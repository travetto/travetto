import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCodecValue } from '@travetto/rest';
import { JWTSigner } from '@travetto/jwt';

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

  signer: JWTSigner<Principal>;

  value: RestCodecValue<string>;

  postConstruct(): void {
    this.signer = new JWTSigner(this.config.signingKey!,
      v => ({
        expiresAt: v.expiresAt!,
        issuedAt: v.issuedAt!,
        issuer: v.issuer!,
        id: v.id,
        sessionId: v.sessionId
      })
    );

    this.value = new RestCodecValue({
      header: this.config.mode !== 'cookie' ? this.config.header : undefined!,
      cookie: this.config.mode !== 'header' ? this.config.cookie : undefined,
      headerPrefix: this.config.headerPrefix
    });
  }

  /**
   * Encode JWT to response
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    const token = p ? await this.signer.create(p) : undefined;
    this.value.writeValue(res, token, { expires: p?.expiresAt });
  }

  /**
   * Decode JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = this.value.readValue(req);
    if (token) {
      const res = await this.signer.verify(token);
      this.authContext.authToken = { type: 'jwt', value: token };
      return res;
    }
  }
}
