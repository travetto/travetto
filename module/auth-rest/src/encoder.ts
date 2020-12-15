import { Request, Response } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';

/**
 * Encoder for auth context for request/response
 * @concrete ./internal/types:AuthContextEncoderTarget
 */
export interface AuthContextEncoder {
  /**
   * Write context
   * @param req The travetto request
   * @param res The travetto response
   * @param ctx The auth context
   */
  encode(req: Request, res: Response, ctx: AuthContext): Promise<void>;
  /**
   * Read context from request
   * @param req The travetto request
   */
  decode(req: Request): Promise<AuthContext | undefined>;
}