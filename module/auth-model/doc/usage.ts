import { AppError } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ModelPrincipalSource } from '@travetto/auth-model';

import { User } from './model';

@Injectable()
class UserService {

  @Inject()
  private auth: ModelPrincipalSource<User>;

  async authenticate(identity: User) {
    try {
      return await this.auth.authenticate(identity.id!, identity.password!);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        return await this.auth.register(identity);
      } else {
        throw err;
      }
    }
  }
}