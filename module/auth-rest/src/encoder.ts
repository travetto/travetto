import { Principal } from '@travetto/auth/src/types';
import { Request, Response } from '@travetto/rest';

/**
 * Encoder for auth context for request/response
 * @concrete ./internal/types:PrincipalEncoderTarget
 */
export interface PrincipalEncoder {
  /**
   * Write principal
   * @param req The travetto request
   * @param res The travetto response
   * @param p The auth principal
   */
  encode(req: Request, res: Response, p: Principal | undefined): Promise<void>;
  /**
   * Read principal from request
   * @param req The travetto request
   */
  decode(req: Request): Promise<Principal | undefined>;
}