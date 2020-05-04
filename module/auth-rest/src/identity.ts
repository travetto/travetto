import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

/**
 * Identity source to support authentication
 */
export abstract class IdentitySource {
  // Undefined allows for multi step identification
  abstract async authenticate(req: Request, res: Response): Promise<Identity | undefined>;
}