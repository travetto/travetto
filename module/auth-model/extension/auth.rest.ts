import { AppError, ErrorCategory } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { ModelCore } from '@travetto/model';
import { AuthProvider } from '@travetto/auth-rest';
import { ERR_INVALID_PASSWORD, AuthContext } from '@travetto/auth';

import { AuthModelService } from '../src/service';

export class AuthModelProvider<U extends ModelCore> extends AuthProvider<U> {

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
      let status: ErrorCategory = 'general';
      switch ((e as Error).message) {
        case ERR_INVALID_PASSWORD:
          status = 'authentication';
          break;
      }
      const out = new AppError(e.message, status);
      out.stack = e.stack;
      throw out;
    }
  }
}