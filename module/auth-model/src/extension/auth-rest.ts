// @file-if @travetto/auth-rest
import { Request, Response } from '@travetto/rest';
import { ModelCore } from '@travetto/model';
import { IdentityProvider } from '@travetto/auth-rest';
import { Identity } from '@travetto/auth';

import { ModelPrincipalProvider } from '../principal';

export class ModelIdentityProvider<U extends ModelCore> extends IdentityProvider {

  constructor(private provider: ModelPrincipalProvider<U>) {
    super();
  }

  async authenticate(req: Request, res: Response): Promise<Identity | undefined> {
    const ident = this.provider.toIdentity(req.body);
    return this.provider.authenticate(ident.id!, ident.password!);
  }
}