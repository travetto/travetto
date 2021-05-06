// @file-if @travetto/auth-rest
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { AppError, Util } from '@travetto/base';
import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';
import { Response, Request } from '@travetto/rest';

import { JWTUtil } from '../util';
import { Payload } from '../types';

/**
 * Principal encoder via JWT
 */
@Config('rest.jwt')
@Injectable()
export class JWTPrincipalEncoder implements PrincipalEncoder {

  #header = 'Authorization';
  #signingKey = 'dummy';
  #headerPrefix = 'Bearer ';
  #defaultAge = Util.timeToMs('1y');

  set signingKey(v: string) { this.#signingKey = v; }
  set header(n: string) { this.#header = n; }
  set headerPrefix(p: string) { this.#headerPrefix = p; }
  set defaultAge(a: number) { this.#defaultAge = a; }

  postConstruct() {
    if (EnvUtil.isProd() && this.#signingKey === 'dummy') {
      throw new AppError('The default signing key is not valid for production use, please specify a config value at jwt.signingKey');
    }
  }

  toJwtPayload(p: Principal) {
    const exp = Math.trunc((p.expiresAt?.getTime() ?? (Date.now() + this.#defaultAge)) / 1000);
    const iat = Math.trunc((p.issuedAt?.getTime() ?? Date.now()) / 1000);
    return {
      auth: p,
      exp,
      iat,
      iss: p.issuer,
      sub: p.id,
    } as Payload;
  }

  /**
   * Get token for principal
   */
  async getToken(p: Principal) {
    return await JWTUtil.create(this.toJwtPayload(p), { key: this.#signingKey });
  }

  /**
   * Verify token to principal
   * @param token
   */
  async verifyToken(token: string) {
    return (await JWTUtil.verify<{ auth: Principal }>(token, { key: this.#signingKey })).auth;
  }

  /**
   * Write context
   */
  async encode(req: Request, res: Response, p: Principal | undefined) {
    if (p) {
      res.setHeader(this.#header, `${this.#headerPrefix}${await this.getToken(p)}`);
    }
  }

  /**
   * Read JWT from request
   */
  async decode(req: Request) {
    const token = (req.header(this.#header) as string)?.replace(this.#headerPrefix, '');
    if (token) {
      return this.verifyToken(token);
    }
  }
}