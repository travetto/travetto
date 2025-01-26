import { AuthContext, Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-rest';
import { TimeUtil } from '@travetto/runtime';
import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCodecValue } from '@travetto/rest';
import { JWTUtil, Payload } from '@travetto/jwt';
import { RestJWTConfig } from './config';

/**
 * Principal codec via JWT
 */
@Injectable()
export class JWTPrincipalCodec implements PrincipalCodec {

  @Inject()
  config: RestJWTConfig;

  @Inject()
  authContext: AuthContext;

  value: RestCodecValue;

  postConstruct(): void {
    this.value = new RestCodecValue({
      header: this.config.mode !== 'cookie' ? this.config.header : undefined!,
      cookie: this.config.mode !== 'header' ? this.config.cookie : undefined,
      headerPrefix: this.config.headerPrefix
    });
  }

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
    const res = await this.config.verifyToken(token);
    if (setActive) {
      this.authContext.authToken = { value: token, type: 'jwt' };
    }
    return {
      ...res,
      expiresAt: new Date(res.expiresAt!),
      issuedAt: new Date(res.issuedAt!),
    };
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
   * Write context
   */
  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    const token = p ? await this.getToken(p) : undefined;
    this.value.writeValue(res, token, { expires: p?.expiresAt });
  }

  /**
   * Read JWT from request
   */
  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const token = this.value.readValue(req);
    if (token) {
      return await this.verifyToken(token, true);
    }
  }
}
