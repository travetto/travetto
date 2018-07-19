import { Request, Response } from 'express';

import { AppError } from '@travetto/express';
import { BaseModel } from '@travetto/model';
import { AuthProvider } from '@travetto/auth-express';
import { ERR_INVALID_PASSWORD, AuthContext } from '@travetto/auth';

import { AuthModelService } from '../src';

export class AuthModelProvider<U extends BaseModel> extends AuthProvider<U> {

  constructor(private service: AuthModelService<U>) {
    super();
  }

  toContext(principal: U) {
    return this.service.principalConfig.toContext(principal);
  }

  async login(req: Request, res: Response): Promise<AuthContext<U>> {
    const userId = this.service.principalConfig.getId(req.body);
    const password = this.service.principalConfig.getPassword(req.body);

    try {
      const user = await this.service.login(userId, password);
      return this.toContext(user);
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