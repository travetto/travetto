import { AuthContext, Principal } from '@travetto/auth';
import { DefaultPrincipalCodec, PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';
import { JWTSigner } from '@travetto/jwt';
import { Util } from '@travetto/runtime';

import { RestJWTConfig } from './config';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec extends DefaultPrincipalCodec implements PrincipalCodec {

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
      }),
      v => ({
        ...v,
        expiresAt: typeof v.expiresAt === 'string' ? new Date(v.expiresAt) : v.expiresAt,
        issuedAt: typeof v.issuedAt === 'string' ? new Date(v.issuedAt) : v.issuedAt
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

  /**
   * Encode JWT to response
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    let token = p ? await this.signer.create(p) : undefined;
    if (token) {
      token = Util.encodeSafeJSON(token)!;
    }
    this.writeValue(res, token, p?.expiresAt);
  }

  /**
   * Decode JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    let token = this.readValue(req);
    if (token) {
      token = Util.decodeSafeJSON(token)!;
      const res = await this.signer.verify(token);
      this.authContext.authToken = { type: 'jwt', value: token };
      return res;
    }
  }
}
