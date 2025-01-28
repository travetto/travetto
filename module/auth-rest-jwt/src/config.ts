import { Principal } from '@travetto/auth';
import { Config } from '@travetto/config';
import { JWTSigner } from '@travetto/jwt';
import { Runtime, AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  signingKey?: string;

  @Ignore()
  signer: JWTSigner<Principal>;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';

    this.signer = new JWTSigner(this.signingKey!,
      v => ({
        expiresAt: v.expiresAt!,
        issuedAt: v.issuedAt!,
        issuer: v.issuer!,
        id: v.id,
        sessionId: v.sessionId
      })
    );
  }
}