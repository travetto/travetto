import { MemoryModelService } from '@travetto/model';
import { Cache, EvictCache, CacheService } from '@travetto/cache';

class User { }

export class UserService {

  myCache = new CacheService(new MemoryModelService({ namespace: '' }));
  database: {
    lookupUser(id: string): Promise<User>;
    deleteUser(id: string): Promise<void>;
    updateUser(user: User): Promise<User>;
  };

  @Cache('myCache', '5m', { keySpace: 'user.id' })
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
