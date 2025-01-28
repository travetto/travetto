import { Config } from '@travetto/config';
import { Runtime, AppError } from '@travetto/runtime';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: 'cookie' | 'header' | 'all' = 'header';
  header?: string;
  cookie?: string;
  signingKey?: string;
  headerPrefix?: string;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';

    if (this.mode !== 'cookie') {
      this.header ??= 'Authorization';
      this.headerPrefix ||= 'Bearer';
    }

    if (this.mode !== 'header') {
      this.cookie ??= 'trv_auth';
    }
  }
}