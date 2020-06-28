import { MemoryCacheSource } from '../../../src/source/memory';
import { Cache, EvictCache } from '../../../src/decorator';

class User { }

export class UserService {

  myCache = new MemoryCacheSource();
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
