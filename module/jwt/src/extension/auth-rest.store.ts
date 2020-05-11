// @file-if @travetto/auth-rest
import { AuthContext } from '@travetto/auth';
import { AuthContextEncoder } from '@travetto/auth-rest';
import { Response, Request } from '@travetto/rest';

import { sign } from '../sign';
import { verify } from '../verify';

/**
 * Auth context store via JWT
 */
export class JWTAuthContextStore extends AuthContextEncoder {

  /**
   * Singing key
   */
  signingKey: string;

  /**
   * Location of storage
   */
  location: 'cookie' | 'header';

  /**
   * Name of cookie/header key
   */
  name: string;

  /**
   * Write context
   */
  async write(ctx: AuthContext, req: Request, res: Response) {
    const body = { ...ctx, exp: ctx.principal.expires!.getTime() / 1000 };
    (body.principal as any).permissions = [...ctx.principal.permissions];
    const token = await sign(body, { key: this.signingKey });
    if (this.location === 'cookie') {
      res.cookies.set(this.name, token);
    } else {
      res.setHeader(this.name, token);
    }
  }

  /**
   * Read JWT from location
   */
  async read(req: Request) {
    const input = this.location === 'cookie' ? req.cookies.get(this.name) : req.header(this.name);
    const ac = (await verify(input!, { key: this.signingKey })) as any as AuthContext;
    return ac;
  }
}