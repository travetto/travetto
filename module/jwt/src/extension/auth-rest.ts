// @file-if @travetto/auth-rest
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { Response, Request } from '@travetto/rest';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { sign } from '../sign';
import { verify } from '../verify';

/**
 * Auth context store via JWT
 */
export class JWTAuthContextEncoder implements PrincipalEncoder {

  #accessor: ValueAccessor;
  #signingKey: string;

  constructor(
    /**
     * Singing key
     */
    signingKey: string,

    /**
     * Name of cookie/header key
     */
    name: string,

    /**
     * Location of storage
     */
    location: 'cookie' | 'header'
  ) {
    this.#accessor = new ValueAccessor(name, location);
    this.#signingKey = signingKey;
  }

  /**
   * Write context
   */
  async encode(req: Request, res: Response, p: Principal | undefined) {
    if (p) {
      const expires = p.expiresAt || new Date(Date.now() + (1000 * 60 * 60 * 24 * 365));
      const body = {
        ...p, exp: Math.trunc(expires.getTime() / 1000)
      };
      if (p.permissions) {
        body.permissions = [...p.permissions];
      }
      const token = await sign(body, { key: this.#signingKey });
      this.#accessor.writeValue(res, token, { expires });
    }
  }

  /**
   * Read JWT from request
   */
  async decode(req: Request) {
    const input = this.#accessor.readValue(req);
    if (input) {
      return await verify<Principal>(input!, { key: this.#signingKey });
    }
  }
}