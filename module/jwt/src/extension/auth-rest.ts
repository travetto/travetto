// @file-if @travetto/auth-rest
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { AppError } from '@travetto/base';
import { TimeUtil } from '@travetto/base/src/internal/time';
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
  #defaultAge = TimeUtil.toMillis('1y');

  set signingKey(v: string) { this.#signingKey = v; }
  set header(n: string) { this.#header = n; }
  set headerPrefix(p: string) { this.#headerPrefix = p; }
  set defaultAge(a: number) { this.#defaultAge = a; }

  postConstruct() {
    if (EnvUtil.isReadonly() && this.#signingKey === 'dummy') {
      throw new AppError('The default signing key is not valid for production use, please specify a config value at jwt.signingKey');
    }
  }

  send(res: Response, value: string) {
    res.setHeader(this.#header, `${this.headerPrefix}${value}`);
  }

  receive(req: Request) {
    return (req.header(this.#header) as string)?.replace(this.#headerPrefix, '');
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
   * Write context
   */
  async encode(req: Request, res: Response, p: Principal | undefined) {
    if (p) {
      const token = await JWTUtil.create(this.toJwtPayload(p), { key: this.#signingKey });
      this.send(res, token);
    }
  }

  /**
   * Read JWT from request
   */
  async decode(req: Request) {
    const token = this.receive(req);
    if (token) {
      return (await JWTUtil.verify<{ auth: Principal }>(token, { key: this.#signingKey })).auth;
    }
  }
}