import { MemoryModelService } from '@travetto/model-memory';
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
  async getUser(id: string): Promise<User> {
    return this.database.lookupUser(id);
  }

  @EvictCache('myCache', { keySpace: 'user.id', params: user => [user.id] })
  async updateUser(user: User): Promise<void> {
    this.database.updateUser(user);
  }

  @EvictCache('myCache', { keySpace: 'user.id' })
  async deleteUser(userId: string): Promise<void> {
    this.database.deleteUser(userId);
  }
}
