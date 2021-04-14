// @file-if @travetto/auth-rest
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { AppError } from '@travetto/base';
import { TimeUtil } from '@travetto/base/src/internal/time';
import { EnvUtil } from '@travetto/boot/src';
import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';
import { Response, Request } from '@travetto/rest';

import { JWTUtil } from '../util';

/**
 * Principal store via JWT
 */
@Config('jwt')
@Injectable()
export class JWTPrincipalEncoder implements PrincipalEncoder {

  #header = 'Authorization';
  #signingKey = 'dummy';
  #headerPrefix = 'Bearer ';

  set signingKey(v: string) { this.#signingKey = v; }
  set header(n: string) { this.#header = n; }
  set headerPrefix(p: string) { this.#headerPrefix = p; }

  postConstruct() {
    if (EnvUtil.isReadonly() && this.#signingKey === 'dummy') {
      throw new AppError('The default signing key is not valid for production use, please specify a value at jwt.signingKey');
    }
  }

  /**
   * Write context
   */
  async encode(req: Request, res: Response, p: Principal | undefined) {
    if (p) {
      const expires = (p.expiresAt ?? TimeUtil.withAge(1, 'y')).getTime();
      const body = { ...p, exp: Math.trunc(expires / 1000) };
      if (p.permissions) {
        body.permissions = [...p.permissions];
      }
      const token = await JWTUtil.create(body, { key: this.#signingKey });
      res.setHeader(this.#header, `${this.#headerPrefix}${token}`);
    }
  }

  /**
   * Read JWT from request
   */
  async decode(req: Request) {
    const input = req.header(this.#header) as string;
    if (input) {
      return await JWTUtil.verify<Principal>(input.replace(this.#headerPrefix, ''), { key: this.#signingKey });
    }
  }
}