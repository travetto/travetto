import { Config } from '@travetto/config';
import { Runtime, AppError } from '@travetto/runtime';
import { Secret } from '@travetto/schema';

@Config('rest.auth')
export class RestAuthConfig {
  mode: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';
  @Secret()
  signingKey?: string;

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.signingKey');
    }
    this.signingKey ??= 'dummy';
  }
}
