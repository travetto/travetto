import { AppError } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ModelAuthService } from '@travetto/auth';

import { User } from './model';

@Injectable()
class UserService {

  @Inject()
  private auth: ModelAuthService<User>;

  async authenticate(identity: User) {
    try {
      return await this.auth.authenticate(identity);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        return await this.auth.register(identity);
      } else {
        throw err;
      }
    }
  }
}