import { Principal } from '@travetto/auth';
import { Config } from '@travetto/config';
import { RestCodecTransport, RestCodecValue } from '@travetto/rest';
import { Runtime, AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';
import { JWTSigner } from '@travetto/jwt';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: RestCodecTransport | 'all' = 'header';
  header = 'Authorization';
  cookie = 'trv.auth';
  signingKey?: string;
  headerPrefix = 'Bearer';

  @Ignore()
  signer: JWTSigner<Principal>;

  @Ignore()
  value: RestCodecValue<string>;

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
      }),
      v => ({
        ...v,
        expiresAt: new Date(v.expiresAt!),
        issuedAt: new Date(v.issuedAt!),
      })
    );

    this.value = new RestCodecValue({
      header: this.mode !== 'cookie' ? this.header : undefined!,
      cookie: this.mode !== 'header' ? this.cookie : undefined,
      headerPrefix: this.headerPrefix
    });
  }
}