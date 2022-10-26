import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { AppError, EnvUtil, TimeUtil } from '@travetto/base';
import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';
import { JWTUtil, Payload } from '@travetto/jwt';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  header = 'Authorization';
  signingKey = 'dummy';
  headerPrefix = 'Bearer ';
  defaultAge = TimeUtil.timeToMs('1y');

  postConstruct(): void {
    if (EnvUtil.isProd() && this.signingKey === 'dummy') {
      throw new AppError('The default signing key is not valid for production use, please specify a config value at rest.jwt.signingKey');
    }
  }
}

/**
 * Principal encoder via JWT
 */
@Injectable()
export class JWTPrincipalEncoder implements PrincipalEncoder {

  @Inject()
  config: RestJWTConfig;

  toJwtPayload(p: Principal): Payload {
    const exp = Math.trunc((p.expiresAt?.getTime() ?? (Date.now() + this.config.defaultAge)) / 1000);
    const iat = Math.trunc((p.issuedAt?.getTime() ?? Date.now()) / 1000);
    return {
      auth: p,
      exp,
      iat,
      iss: p.issuer,
      sub: p.id,
    };
  }

  /**
   * Get token for principal
   */
  async getToken(p: Principal): Promise<string> {
    return await JWTUtil.create(this.toJwtPayload(p), { key: this.config.signingKey });
  }

  /**
   * Verify token to principal
   * @param token
   */
  async verifyToken(token: string): Promise<Principal> {
    return (await JWTUtil.verify<{ auth: Principal }>(token, { key: this.config.signingKey })).auth;
  }

  /**
   * Write context
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    if (p) {
      res.setHeader(this.config.header, `${this.config.headerPrefix}${await this.getToken(p)}`);
    }
  }

  /**
   * Read JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = (req.headerFirst(this.config.header))?.replace(this.config.headerPrefix, '');
    if (token) {
      return this.verifyToken(token);
    }
  }
}