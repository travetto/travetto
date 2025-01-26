import { Principal } from '@travetto/auth';
import { Config } from '@travetto/config';
import { JWTUtil } from '@travetto/jwt';
import { RestCodecTransport } from '@travetto/rest';
import { TimeSpan, TimeUtil, Runtime, AppError } from '@travetto/runtime';
import { Ignore } from '@travetto/schema';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: RestCodecTransport | 'all' = 'header';
  header = 'Authorization';
  cookie = 'trv.auth';
  signingKey?: string;
  headerPrefix = 'Bearer';
  maxAge: TimeSpan | number = '1h';
  rollingRenew: boolean = false;

  @Ignore()
  maxAgeMs: number;

  postConstruct(): void {
    this.maxAgeMs = TimeUtil.asMillis(this.maxAge);

    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';
  }

  async verifyToken(token: string): Promise<Principal> {
    return (await JWTUtil.verify<{ auth: Principal }>(token, { key: this.signingKey })).auth;
  }
}