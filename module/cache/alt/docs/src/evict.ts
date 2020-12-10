import { MemoryModelService } from '@travetto/model-core';
import { Cache, EvictCache } from '../../../src/decorator';
import { CacheService } from '../../../src/service';

class User { }

export class UserService {

  myCache = new CacheService(new MemoryModelService({ namespace: '' }));
  database: any;

  @Cache('myCache', { keySpace: 'user.id' })
  async getUser(id: string) {
    return this.database.lookupUser(id);
  }

  @EvictCache('myCache', { keySpace: 'user.id', params: user => [user.id] })
  async updateUser(user: User) {
    this.database.updateUser(user);
  }

  @EvictCache('myCache', { keySpace: 'user.id' })
  async deleteUser(userId: string) {
    this.database.deleteUser(userId);
  }
}
