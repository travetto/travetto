import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec, RestAuthConfig } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCommonUtil } from '@travetto/rest';
import { JWTSigner } from '@travetto/jwt';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: RestAuthConfig;

  @Inject()
  authContext: AuthContext;

  #signer: JWTSigner<Principal>;

  get signer(): JWTSigner<Principal> {
    return this.#signer ??= new JWTSigner(this.config.signingKey!,
      v => ({
        expiresAt: v.expiresAt!,
        issuedAt: v.issuedAt!,
        issuer: v.issuer!,
        id: v.id,
        sessionId: v.sessionId
      })
    );
  }

  async decode(ctx: FilterContext): Promise<Principal | undefined> {
    const token = RestCommonUtil.readValue({ ...this.config, signingKey: undefined }, ctx.req);
    if (token && typeof token === 'string') {
      const out = await this.signer.verify(token);
      if (out) {
        this.authContext.authToken = { type: 'jwt', value: token };
      }
      return out;
    }
  }

  async encode(ctx: FilterContext, data: Principal | undefined): Promise<void> {
    const token = data ? await this.signer.create(data) : undefined;
    RestCommonUtil.writeValue({ ...this.config, signingKey: undefined }, ctx.res, token, { expires: data?.expiresAt });
  }
}
