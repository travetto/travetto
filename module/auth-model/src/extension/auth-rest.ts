// @file-if @travetto/auth-rest
import { Request, Response } from '@travetto/rest';
import { ModelCore } from '@travetto/model';
import { IdentitySource } from '@travetto/auth-rest';
import { Identity } from '@travetto/auth';

import { ModelPrincipalSource } from '../principal';

/**
 * Provides an identity verification source in conjunction with the
 * provided principal source.
 */
export class ModelIdentitySource<U extends ModelCore> extends IdentitySource {

  constructor(private source: ModelPrincipalSource<U>) {
    super();
  }

  async authenticate(req: Request, res: Response): Promise<Identity | undefined> {
    const ident = this.source.toIdentity(req.body);
    return this.source.authenticate(ident.id!, ident.password!);
  }
}