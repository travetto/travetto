import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';

function toCtx(val: AuthContext | undefined) {
  if (val && val.constructor !== AuthContext) {
    val = new AuthContext(val.identity, val.principal);
  }
  return val;
}

export abstract class AuthContextStore {
  abstract read(req: Request): Promise<AuthContext | undefined> | undefined | AuthContext;
  abstract write(req: Request, res: Response, ctx?: AuthContext): Promise<void> | void;
}

export class SessionAuthContextStore extends AuthContextStore {
  key = '__auth_context__';

  read(req: Request) {
    return toCtx(req.session[this.key]);
  }

  write(req: Request, res: Response, ctx?: AuthContext) {
    if (ctx) {
      req.session[this.key] = toCtx(ctx);
    } else {
      delete req.session[this.key];
    }
  }
}