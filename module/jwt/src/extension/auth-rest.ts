// @file-if @travetto/auth-rest
import { AuthContext } from '@travetto/auth';
import { AuthContextEncoder } from '@travetto/auth-rest';
import { Response, Request } from '@travetto/rest';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { sign } from '../sign';
import { verify } from '../verify';

/**
 * Auth context store via JWT
 */
export class JWTAuthContextEncoder implements AuthContextEncoder {

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
  async encode(req: Request, res: Response, ctx: AuthContext) {
    if (ctx) {
      const expires = ctx.principal.expiresAt || new Date(Date.now() + (1000 * 60 * 60 * 24 * 365));
      const body: Pick<AuthContext, 'identity' | 'principal'> & { exp: number } = {
        ...ctx, exp: Math.trunc(expires.getTime() / 1000)
      };
      body.principal.permissions = [...ctx.principal.permissions];
      const token = await sign(body, { key: this.#signingKey });
      this.#accessor.writeValue(res, token, { expires });
    }
  }

  /**
   * Read JWT from location
   */
  async decode(req: Request) {
    const input = this.#accessor.readValue(req);
    if (input) {
      const ac = await verify<AuthContext>(input!, { key: this.#signingKey });
      return new AuthContext(ac.identity, ac.principal);
    }
  }
}