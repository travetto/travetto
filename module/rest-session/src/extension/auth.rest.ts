// @file-if @travetto/auth-rest
import { Injectable } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';
import { AuthContextEncoder } from '@travetto/auth-rest';

/**
 * Integration with the auth module,  using the session as a backing
 * store for the auth context.
 */
@Injectable()
export class SessionAuthContextEncoder implements AuthContextEncoder {

  key = '__auth_context__'; // Must be serializable, so it cannot be a symbol
  loaded = false;

  /**
   * Persist the auth context to the session
   */
  async encode(req: Request, res: Response, ctx: AuthContext) {
    if (req.session) {
      if (ctx && ctx.principal) {
        req.session.setValue(this.key, ctx);
      } else {
        req.session.destroy(); // Kill session
      }
    }
  }

  /**
   * Build an auth context on top of the session
   */
  async decode(req: Request) {
    if (req.session) {
      let val = req.session.getValue<AuthContext>(this.key);
      if (val && val.constructor !== AuthContext) {
        val = new AuthContext(val.identity, val.principal);
      }
      return val;
    }
  }
}