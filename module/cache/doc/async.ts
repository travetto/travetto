import { MemoryModelService } from '@travetto/model';
import { Cache, CacheService } from '@travetto/cache';

async function request(url: string): Promise<string> {
  let value: string;
  // ...fetch content
  return value!;
}

export class Worker {

  myCache = new CacheService(
    new MemoryModelService({ namespace: '' })
  );

  @Cache('myCache', '1s')
  async calculateExpensiveResult(expression: string): Promise<string> {
    const value = await request(`https://google.com?q=${expression}`);
    return value;
  }
}