import { MemoryCacheSource } from '../../../src/source/memory';
import { Cache } from '../../../src/decorator';

async function request(url: string) {
  let value;
  // ...fetch content
  return value;
}

export class Worker {

  myCache = new MemoryCacheSource();

  @Cache('myCache', { maxAge: 1000 })
  async calculateExpensiveResult(expression: string) {
    const value = await request(`https://google.com?q=${expression}`);
    return value;
  }
}