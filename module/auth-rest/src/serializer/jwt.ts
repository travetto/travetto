import { AuthContext, AuthContextSerializer } from '@travetto/auth';
import { sign, verify } from '@travetto/jwt';

export class JWTAuthContextSerializer extends AuthContextSerializer {

  constructor(private signingKey: string) {
    super();
  }

  async serialize(context: AuthContext): Promise<string> {
    const body = { ...context, exp: context.principal.expires!.getTime() / 1000 };
    (body.principal as any).permissions = [...context.principal.permissions];
    return sign(body, { key: this.signingKey });
  }

  async deserialize(input: string): Promise<AuthContext> {
    const ac = (await verify(input, { key: this.signingKey })) as any as AuthContext;
    ac.principal.permissions = new Set(ac.principal.permissions);
    return ac;
  }
}