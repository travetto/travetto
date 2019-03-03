import { Request, Response } from '@travetto/rest';
import { Identity } from '@travetto/auth';

export abstract class IdentityProvider {
  abstract async authenticate(req: Request, res: Response): Promise<Identity | undefined>; // Undefined allows for multi step identification
}