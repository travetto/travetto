import { AuthContext } from '@travetto/auth';
import { AuthContextStore } from '@travetto/auth-rest';

import { sign, verify } from '..';

export class JWTAuthContextStore extends AuthContextStore {

  signingKey: string;
  location: 'cookie' | 'header';
  name: string;

  async write(context: AuthContext) {
    const body = { ...context, exp: context.principal.expires!.getTime() / 1000 };
    (body.principal as any).permissions = [...context.principal.permissions];
    const token = await sign(body, { key: this.signingKey });
    if (this.location === 'cookie') {
      this.res.cookies.set(this.name, token);
    } else {
      this.res.setHeader(this.name, token);
    }
  }

  async read(): Promise<AuthContext> {
    const input = this.location === 'cookie' ? this.req.cookies.get(this.name) : this.req.header(this.name);
    const ac = (await verify(input!, { key: this.signingKey })) as any as AuthContext;
    return ac;
  }
}