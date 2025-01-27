import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-rest';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCodecValue } from '@travetto/rest';

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

  value: RestCodecValue<string>;

  postConstruct(): void {
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
    const token = p ? await this.config.signer.create(p) : undefined;
    this.value.writeValue(res, token, { expires: p?.expiresAt });
  }

  /**
   * Decode JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = this.value.readValue(req);
    if (token) {
      const res = await this.config.signer.verify(token);
      this.authContext.authToken = { type: 'jwt', value: token };
      return res;
    }
  }
}
