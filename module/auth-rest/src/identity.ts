import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

/**
 * Identity source to support authentication
 */
export abstract class IdentitySource {
  /**
   * Verify the information from the request, authenticate into an Identity
   *
   * @param req The travetto request
   * @param res The travetto response
   */
  abstract authenticate(req: Request, res: Response): Promise<Identity | undefined>;
}