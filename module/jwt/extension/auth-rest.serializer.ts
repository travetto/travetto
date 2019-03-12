import { AuthContext } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { RestAuthContextSerializer } from '@travetto/auth-rest';
import { sign, verify } from '..';

export class JWTAuthContextSerializer extends RestAuthContextSerializer {

  constructor(private signingKey: string, private location: 'header' | 'cookie' = 'cookie') {
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

  async writeToResponse(request: Request, response: Response, token: string, context: AuthContext): Promise<void> {
    if (this.location === 'header') {
      response.setHeader('auth-token', token);
    } else {
      response.cookie('auth-token', token, { expires: context.principal.expires });
    }
  }

  async getFromRequest(request: Request): Promise<string | undefined> {
    let input: string | undefined;
    if (this.location === 'header') {
      input = request.header('auth-token');
    } else {
      input = request.cookies['auth-token'] as string;
    }
    return input;
  }
}