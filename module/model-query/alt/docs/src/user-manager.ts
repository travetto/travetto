import { Injectable, Inject } from '@travetto/di';
import { ModelBulkSupport } from '@travetto/model-core';
import { User } from './user';

@Injectable()
export class UserManager {

  @Inject()
  private service: ModelBulkSupport;

  async register(user: User) {
    const created = await this.service.create(User, user);
    // send welcome email
    return created;
  }

  async bulkCreate(users: User[]) {
    const res = await this.service.processBulk(User, users.map(user => ({ insert: user })));
    // notify administrator of completion
    return res;
  }
}
