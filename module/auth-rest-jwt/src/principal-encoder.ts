import { AuthService, Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { AppError, Runtime, TimeSpan, TimeUtil } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext } from '@travetto/rest';
import { JWTUtil, Payload } from '@travetto/jwt';
import { Ignore } from '@travetto/schema';

@Config('rest.auth.jwt')
export class RestJWTConfig {
  mode: 'cookie' | 'header' | 'all' = 'header';
  header = 'Authorization';
  cookie = 'trv.auth';
  signingKey?: string;
  headerPrefix = 'Bearer';
  maxAge: TimeSpan | number = '1h';
  rollingRenew: boolean = false;

  @Ignore()
  maxAgeMs: number;

  get cookieMode(): boolean {
    return this.mode === 'cookie' || this.mode === 'all';
  }

  get headerMode(): boolean {
    return this.mode === 'header' || this.mode === 'all';
  }

  postConstruct(): void {
    this.maxAgeMs = TimeUtil.asMillis(this.maxAge);

    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.jwt.signingKey');

    }
    this.signingKey ??= 'dummy';
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
    const exp = TimeUtil.asSeconds(p.expiresAt!);
    const iat = TimeUtil.asSeconds(p.issuedAt!);
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
   * Rewrite token with new permissions
   */
  updateTokenPermissions(token: string, permissions: string[]): Promise<string> {
    return JWTUtil.rewrite<{ auth: Principal }>(
      token,
      p => ({
        ...p,
        auth: {
          ...p.auth,
          permissions
        }
      }),
      { key: this.config.signingKey }
    );
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
      if (this.config.cookieMode) {
        res.cookies.set(this.config.cookie, token, { expires: p.expiresAt });
      }
      if (this.config.headerMode) {
        res.setHeader(this.config.header, [this.config.headerPrefix, token].join(' ').trimStart());
      }
    } else if (this.config.cookieMode) {
      res.cookies.set(this.config.cookie, '', { expires: TimeUtil.fromNow(-1, 'h') }); // Clear out cookie
    }
  }

  /**
   * Run before encoding, allowing for session extending if needed
   */
  preEncode(p: Principal): void {
    p.expiresAt ??= TimeUtil.fromNow(this.config.maxAgeMs);
    p.issuedAt ??= new Date();

    if (this.config.rollingRenew) {
      const end = p.expiresAt.getTime();
      const midPoint = end - this.config.maxAgeMs / 2;
      if (Date.now() > midPoint) { // If we are past the half way mark, renew the token
        p.issuedAt = new Date();
        p.expiresAt = TimeUtil.fromNow(this.config.maxAgeMs); // This will trigger a re-send
      }
    }
  }

  /**
   * Read JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    let token: string | undefined = undefined;
    if (this.config.cookieMode) {
      token ??= req.cookies.get(this.config.cookie);
    }
    if (this.config.headerMode) {
      const header = req.headerFirst(this.config.header);
      if (header?.startsWith(this.config.headerPrefix)) {
        token ??= header.replace(this.config.headerPrefix, '').trim();
      }
    }

    if (token) {
      return await this.verifyToken(token, true);
    }
  }
}
