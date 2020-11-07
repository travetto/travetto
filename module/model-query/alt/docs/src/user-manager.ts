import { Injectable, Inject } from '@travetto/di';
import { ModelService } from '../../../src/service/model';
import { User } from './user';

@Injectable()
export class UserManager {

  @Inject()
  private service: ModelService;

  async register(user: User) {
    const created = await this.service.save(User, user);
    // send welcome email
    return created;
  }

  async bulkCreate(users: User[]) {
    const res = await this.service.bulkProcess(User, users.map(user => ({ insert: user })));
    // notify administrator of completion
    return res;
  }
}
