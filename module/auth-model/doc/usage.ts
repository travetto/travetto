import type { ModelAuthService } from '@travetto/auth-model';
import { Inject, Injectable } from '@travetto/di';
import { RuntimeError } from '@travetto/runtime';

import type { User } from './model.ts';

@Injectable()
class UserService {
  @Inject()
  private auth: ModelAuthService<User>;

  async authenticate(identity: User) {
    try {
      return await this.auth.authenticate(identity);
    } catch (error) {
      if (error instanceof RuntimeError && error.category === 'notfound') {
        return await this.auth.register(identity);
      } else {
        throw error;
      }
    }
  }
}
