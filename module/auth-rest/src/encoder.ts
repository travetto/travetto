import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';

/**
 * Encoder for auth context for request/response
 * @concrete ./internal/types:AuthContextEncoderTarget
 */
export interface AuthContextEncoder {
  /**
   * Read context from request
   * @param req The travetto request
   */
  read(req: Request): Promise<AuthContext | undefined> | undefined | AuthContext;
  /**
   * Write context
   * @param ctx The auth context
   * @param req The travetto request
   * @param res The travetto response
   */
  write(ctx: AuthContext, req: Request, res: Response): Promise<void> | void;
}