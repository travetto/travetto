import { AuthContext } from '@travetto/auth';
import { AuthContextEncoder } from '@travetto/auth-rest';
import { Response, Request } from '@travetto/rest';

import { sign, verify } from '..';

export class JWTAuthContextStore extends AuthContextEncoder {

  signingKey: string;
  location: 'cookie' | 'header';
  name: string;

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

  async read(req: Request) {
    const input = this.location === 'cookie' ? req.cookies.get(this.name) : req.header(this.name);
    const ac = (await verify(input!, { key: this.signingKey })) as any as AuthContext;
    return ac;
  }
}