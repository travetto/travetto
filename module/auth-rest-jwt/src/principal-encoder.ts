import { Principal } from '@travetto/auth';
import { AuthService, PrincipalEncoder } from '@travetto/auth-rest';
import { AppError, GlobalEnv, TimeUtil } from '@travetto/base';
import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';
import { JWTUtil, Payload } from '@travetto/jwt';
import { Ignore } from '@travetto/schema';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: 'cookie' | 'header' = 'header';
  header = 'Authorization';
  cookie = 'trv.auth';
  signingKey?: string;
  headerPrefix = 'Bearer ';
  maxAge: string | number = '1h';
  rollingRenew: boolean = false;

  @Ignore()
  maxAgeMs: number;

  postConstruct(): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.maxAgeMs = typeof this.maxAge === 'string' ? TimeUtil.timeToMs(this.maxAge as '1y') : this.maxAge;

    if (!this.signingKey) {
      if (GlobalEnv.prod) {
        throw new AppError('The default signing key is not valid for production use, please specify a config value at rest.auth.jwt.signingKey');
      }
      this.signingKey = 'dummy';
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

  @Inject()
  auth: AuthService;

  toJwtPayload(p: Principal): Payload {
    const exp = Math.trunc(p.expiresAt!.getTime() / 1000);
    const iat = Math.trunc(p.issuedAt!.getTime() / 1000);
    return {
      auth: {
        ...p,
      },
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
  async verifyToken(token: string, setActive = false): Promise<Principal> {
    const res = (await JWTUtil.verify<{ auth: Principal }>(token, { key: this.config.signingKey })).auth;
    if (setActive) {
      this.auth.setAuthenticationToken({ token, type: 'jwt' });
    }
    return {
      ...res,
      expiresAt: new Date(res.expiresAt!),
      issuedAt: new Date(res.issuedAt!),
    };
  }

  /**
   * Write context
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    if (p) {
      const token = await this.getToken(p);
      if (this.config.mode === 'cookie') {
        res.cookies.set(this.config.cookie, token, { expires: p.expiresAt });
      } else {
        res.setHeader(this.config.header, `${this.config.headerPrefix}${token}`);
      }
    } else if (this.config.mode === 'cookie') {
      res.cookies.set(this.config.cookie, '', { expires: new Date(Date.now() - 1000 * 60 * 60) }); // Clear out cookie
    }
  }

  /**
   * Run before encoding, allowing for session extending if needed
   */
  preEncode(p: Principal): void {
    p.expiresAt ??= new Date(Date.now() + this.config.maxAgeMs);
    p.issuedAt ??= new Date();

    if (this.config.rollingRenew) {
      const end = p.expiresAt.getTime();
      const midPoint = end - this.config.maxAgeMs / 2;
      if (Date.now() > midPoint) { // If we are past the half way mark, renew the token
        p.issuedAt = new Date();
        p.expiresAt = new Date(Date.now() + this.config.maxAgeMs); // This will trigger a re-send
      }
    }
  }

  /**
   * Read JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = this.config.mode === 'cookie' ?
      req.cookies.get(this.config.cookie) :
      (req.headerFirst(this.config.header))?.replace(this.config.headerPrefix, '');

    if (token) {
      return this.verifyToken(token, true);
    }
  }
}