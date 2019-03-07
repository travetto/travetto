import { Request, Response } from '@travetto/rest';
import { ModelCore } from '@travetto/model';
import { IdentityProvider } from '@travetto/auth-rest';
import { Identity } from '@travetto/auth';

import { ModelPrincipalProvider } from '../src/principal';

export class ModelIdentityProvider<U extends ModelCore> extends IdentityProvider {

  constructor(private service: ModelPrincipalProvider<U>) {
    super();
  }

  async authenticate(req: Request, res: Response): Promise<Identity | undefined> {
    const ident = this.service.toIdentity(req.body);
    return this.service.authenticate(ident.id!, ident.password!);
  }
}