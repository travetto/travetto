import { Injectable } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';
import { AuthContextEncoder } from '@travetto/auth-rest';

@Injectable()
export class SessionAuthContextEncoder extends AuthContextEncoder {
  key = '__auth_context__';
  loaded = false;

  read(req: Request) {
    let val = req.session.data[this.key];
    if (val && val.constructor !== AuthContext) {
      val = new AuthContext(val.identity, val.principal);
    }
    return val;
  }

  write(ctx: AuthContext, req: Request, res: Response) {
    if (ctx && ctx.principal) {
      req.session.data[this.key] = ctx;
    } else {
      req.session.destroy(); // Kill session
    }
  }
}