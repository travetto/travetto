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
export class JWTAuthContextEncoder extends AuthContextEncoder {

  private accessor: ValueAccessor;

  constructor(
    /**
     * Singing key
     */
    private signingKey: string,

    /**
     * Name of cookie/header key
     */
    name: string,

    /**
     * Location of storage
     */
    location: 'cookie' | 'header'
  ) {
    super();
    this.accessor = new ValueAccessor(name, location);
  }

  /**
   * Write context
   */
  async write(ctx: AuthContext, req: Request, res: Response) {
    if (ctx) {
      console.log(ctx.principal);
      const expires = ctx.principal.expires || new Date(Date.now() + (1000 * 60 * 60 * 24 * 365));
      const body: Pick<AuthContext, 'identity' | 'principal'> & { exp: number } = {
        ...ctx, exp: Math.trunc(expires.getTime() / 1000)
      };
      body.principal.permissions = [...ctx.principal.permissions];
      const token = await sign(body, { key: this.signingKey });
      this.accessor.writeValue(res, token, { expires });
    }
  }

  /**
   * Read JWT from location
   */
  async read(req: Request) {
    const input = this.accessor.readValue(req);
    if (input) {
      const ac = await verify<AuthContext>(input!, { key: this.signingKey });
      return new AuthContext(ac.identity, ac.principal);
    }
  }
}