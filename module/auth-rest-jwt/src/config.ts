import { Config } from '@travetto/config';
import { Runtime, AppError } from '@travetto/runtime';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: 'cookie' | 'header' = 'header';
  header?: string;
  cookie?: string;
  signingKey?: string;
  headerPrefix?: string;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';
  }
}