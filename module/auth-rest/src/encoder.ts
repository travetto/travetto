import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';
import { Injectable } from '@travetto/di';

/**
 * Encoder for auth context for request/response
 */
export abstract class AuthContextEncoder {
  /**
   * Read context from request
   * @param req The travetto request
   */
  abstract read(req: Request): Promise<AuthContext | undefined> | undefined | AuthContext;
  /**
   * Write context to request/response
   * @param ctx The auth context
   * @param req The travetto request
   * @param res The travetto response
   */
  abstract write(ctx: AuthContext, req: Request, res: Response): Promise<void> | void;
}

/**
 * Store auth context in http headers
 */
@Injectable({ target: HeaderAuthContextEncoder })
export class HeaderAuthContextEncoder extends AuthContextEncoder {
  key = 'X-Auth-Context';

  read(req: Request) {
    const text = req.header(this.key) as string;
    const ctx = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
    return new AuthContext(ctx.identity, ctx.principal);
  }

  write(ctx: AuthContext, req: Request, res: Response) {
    if (ctx && ctx.principal) {
      const text = Buffer.from(JSON.stringify(ctx)).toString('base64');
      res.setHeader(this.key, text);
    }
  }
}