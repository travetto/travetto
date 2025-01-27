import { Config } from '@travetto/config';
import { RestCodecTransport } from '@travetto/rest';
import { Runtime, AppError } from '@travetto/runtime';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: RestCodecTransport | 'all' = 'header';
  header = 'Authorization';
  cookie = 'trv.auth';
  signingKey?: string;
  headerPrefix = 'Bearer';

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';
  }
}