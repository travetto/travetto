import { MemoryModelService } from '@travetto/model';
import { Cache, CacheService } from '@travetto/cache';

async function request(url: string) {
  let value;
  // ...fetch content
  return value;
}

export class Worker {

  myCache = new CacheService(
    new MemoryModelService({ namespace: '' })
  );

  @Cache('myCache', { maxAge: 1000 })
  async calculateExpensiveResult(expression: string) {
    const value = await request(`https://google.com?q=${expression}`);
    return value;
  }
}