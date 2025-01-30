import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec, RestAuthConfig } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCommonUtil } from '@travetto/rest';
import { JWTSigner } from '@travetto/jwt';
import { Config } from '@travetto/config';
import { AppError, Runtime } from '@travetto/runtime';
import { Secret } from '@travetto/schema';


@Config('rest.auth.jwt')
export class RestJWTConfig {
  @Secret()
  signingKey?: string;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');
    }
    this.signingKey ??= 'dummy';
  }
}

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
    const token = RestCommonUtil.readValue(this.restConfig, ctx.req);
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
    RestCommonUtil.writeValue(this.restConfig, ctx.res, token, { expires: data?.expiresAt });
  }
}
