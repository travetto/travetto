import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';
import { Injectable } from '@travetto/di';

function toCtx(val: AuthContext | undefined) {
  if (val && val.constructor !== AuthContext) {
    val = new AuthContext(val.identity, val.principal);
  }
  return val;
}

export abstract class AuthContextEncoder {
  abstract read(req: Request): Promise<AuthContext | undefined> | undefined | AuthContext;
  abstract write(ctx: AuthContext, req: Request, res: Response): Promise<void> | void;
}

@Injectable({ target: SessionAuthContextEncoder })
export class SessionAuthContextEncoder extends AuthContextEncoder {
  key = '__auth_context__';

  async postConstruct() {
    try {
      require('@travetto/rest-session');
    } catch (e) {
      console.error('To use session based auth contexts, @travetto/rest-session must be installed');
    }
  }

  read(req: Request) {
    return toCtx((req as any).session[this.key]);
  }

  write(ctx: AuthContext, req: Request, res: Response) {
    if (ctx && ctx.principal) {
      (req as any).session[this.key] = ctx;
    } else {
      (req as any).session = undefined; // Kill session
    }
  }
}