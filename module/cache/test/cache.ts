import * as assert from 'assert';

import { Suite as TestSuite, Test } from '@travetto/test';

import { Cache, EvictCache } from '../src/decorator';
import { CacheSuite as Suite } from './decorator';
import { CacheStore, CullableCacheStore } from '../src/store/types';

const wait = (n: number) => new Promise(res => setTimeout(res, n));

class CachingService {

  store: CacheStore;

  @Cache('store', { maxAge: 10 })
  async cullable(num: number) {
    return num * 2;
  }

  @Cache('store')
  async basic(num: number) {
    await wait(100);
    return num * 2;
  }

  @Cache('store', { maxAge: 500 })
  async agesQuickly(num: number) {
    await wait(100);
    return num * 3;
  }

  @Cache('store', { maxAge: 200, extendOnAccess: true })
  async ageExtension(num: number) {
    await wait(100);
    return num * 3;
  }

  @Cache('store')
  async complexInput(config: any, size: number) {
    await wait(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('store', { key: config => config.a })
  async customKey(config: any, size: number) {
    await wait(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('store', { keySpace: 'user.id' })
  async getUser(userId: string) {
    await wait(100);

    return {
      id: userId,
      date: Date.now()
    };
  }

  @EvictCache('store', { keySpace: 'user.id' })
  async deleteUser(userId: string) {
    await wait(100);
    return true;
  }
}

export abstract class CacheTestSuite {

  service = new CachingService();

  baseLatency = 10;

  @Test()
  async basic() {
    let start = Date.now();
    let res = await this.service.basic(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 20);

    start = Date.now();
    res = await this.service.basic(10);
    diff = Date.now() - start;
    assert(diff < (100 + this.baseLatency));
    assert(res === 20);
  }

  @Test()
  async aging() {
    let start = Date.now();
    let res = await this.service.agesQuickly(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    await wait(500);

    start = Date.now();
    res = await this.service.agesQuickly(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async ageWithExtension() {
    let start = Date.now();
    let res = await this.service.ageExtension(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    for (let i = 0; i < 2; i += 1) {
      await wait(55);

      start = Date.now();
      res = await this.service.ageExtension(10);
      diff = Date.now() - start;
      assert(diff < this.baseLatency);
      assert(res === 30);
    }

    await wait(210);
    start = Date.now();
    res = await this.service.ageExtension(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async complex() {
    const val = await this.service.complexInput({ a: 5, b: 20 }, 20);
    const val2 = await this.service.complexInput({ a: 5, b: 20 }, 20);
    assert.deepStrictEqual(val, val2);

    const val3 = await this.service.complexInput({ a: /abc/ }, 20);
    const val4 = await this.service.complexInput({ a: /cde/ }, 20);
    const val5 = await this.service.complexInput({ a: /abc/ }, 20);
    assert(val3 !== val4);
    assert.deepStrictEqual(val3, val5);

    assert(this.service.store.computeKey(/abc/) !== this.service.store.computeKey(/cde/));
  }

  @Test()
  async customKey() {
    const val4 = await this.service.customKey({ a: 5, b: 20 }, 20);
    const val5 = await this.service.customKey({ b: 5, a: 20 }, 30);
    assert(val4 !== val5);

    const val6 = await this.service.customKey({ a: 5, b: 100 }, 50);
    assert.deepStrictEqual(val4, val6);
  }

  @Test()
  async culling() {
    if (this.service.store instanceof CullableCacheStore) {
      await Promise.all(
        ' '.repeat(100)
          .split('')
          .map((x, i) =>
            this.service.cullable(i)));

      const local = this.service.store as CullableCacheStore;
      assert([...(await local.keys())].length > 90);

      await wait(1000);

      await local.cull(true);
      assert([...(await local.keys())].length === 0);
    }
  }

  @Test()
  async eviction() {
    await this.service.getUser('200');
    const start = Date.now();
    await this.service.getUser('200');
    assert((Date.now() - start) <= this.baseLatency);

    await this.service.deleteUser('200');
    const start2 = Date.now();
    await this.service.getUser('200');
    assert((Date.now() - start2) >= this.baseLatency);
  }
}

@Suite()
@TestSuite()
export abstract class FullCacheSuite extends CacheTestSuite {

}