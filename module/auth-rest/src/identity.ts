import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

/**
 * Identity source to support authentication
 *
 * @concrete ./internal/types:IdentitySourceTarget
 */
export interface IdentitySource {
  /**
   * Verify the information from the request, authenticate into an Identity
   *
   * @param req The travetto request
   * @param res The travetto response
   */
  authenticate(req: Request, res: Response): Promise<Identity | undefined>;
}