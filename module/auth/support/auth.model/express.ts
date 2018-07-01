import { Request, Response } from 'express';

import { AppError } from '@travetto/express';
import { BaseModel } from '@travetto/model';

import { AuthProvider } from '../extension.express/provider';
import { RegisteredPrincipalConfig } from './principal';
import { AuthModelService } from './service';
import { ERR_INVALID_PASSWORD, AuthContext } from '../../src';

export class AuthModelProvider<U extends BaseModel> extends AuthProvider<U> {

  constructor(
    private service: AuthModelService<U>,
    private principal: RegisteredPrincipalConfig<U>
  ) {
    super();
  }

  async login(req: Request, res: Response): Promise<AuthContext<U>> {
    const userId = this.principal.getId(req.body);
    const password = this.principal.getPassword(req.body);

    try {
      const user = await this.service.login(userId, password);
      return this.principal.toContext(user);
    } catch (e) {
      let status = 500;
      switch ((e as Error).message) {
        case ERR_INVALID_PASSWORD:
          status = 401;
          break;
      }
      const out = new AppError(e.message, status);
      out.stack = e.stack;
      throw out;
    }
  }
}