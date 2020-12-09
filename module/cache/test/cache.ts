import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model-core/test/lib/test.base';
import { MemoryModelConfig, MemoryModelService, ModelExpirySupport } from '@travetto/model-core';
import { DependencyRegistry, Inject, Injectable, InjectableFactory } from '@travetto/di';

import { Cache, EvictCache } from '../src/decorator';
import { CacheModelSymbol, CacheService } from '../src/service';
import { CacheUtil } from '../src/util';

const wait = (n: number) => new Promise(res => setTimeout(res, n));

class User {
  static from(obj: any) {
    return new User(obj);
  }
  constructor(values: any) {
    Object.assign(this, values);
  }
}

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}


@Injectable()
class SampleService {

  @Inject()
  source: CacheService;

  @Cache('source', { maxAge: 10 })
  async cullable(num: number) {
    return num * 2;
  }

  @Cache('source')
  async basic(num: number) {
    await wait(100);
    return num * 2;
  }

  @Cache('source', { maxAge: 500 })
  async agesQuickly(num: number) {
    await wait(100);
    return num * 3;
  }

  @Cache('source', { maxAge: 200, extendOnAccess: true })
  async ageExtension(num: number) {
    await wait(100);
    return num * 3;
  }

  @Cache('source')
  async complexInput(config: any, size: number) {
    await wait(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('source', { key: config => config.a })
  async customKey(config: any, size: number) {
    await wait(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('source', { keySpace: 'user.id', reinstate: x => User.from(x) })
  async getUser(userId: string) {
    await wait(100);

    return {
      id: userId,
      date: Date.now()
    };
  }

  @EvictCache('source', { keySpace: 'user.id' })
  async deleteUser(userId: string) {
    await wait(100);
    return true;
  }
}

@Suite()
export class CacheTestSuite extends BaseModelSuite<ModelExpirySupport> {

  baseLatency = 10;

  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }

  @BeforeAll()
  async initAll() {
    // const cache = await DependencyRegistry.getInstance(CacheService);
    // cache.cullRate = 1000;
  }

  get cacheService() {
    return DependencyRegistry.getInstance(SampleService);
  }

  @Test()
  async basic() {
    const service = await this.cacheService;
    let start = Date.now();
    let res = await service.basic(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 20);

    start = Date.now();
    res = await service.basic(10);
    diff = Date.now() - start;
    assert(diff < (100 + this.baseLatency));
    assert(res === 20);
  }

  @Test()
  async aging() {
    const service = await this.cacheService;

    let start = Date.now();
    let res = await service.agesQuickly(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    await wait(510);

    start = Date.now();
    res = await service.agesQuickly(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.cacheService;

    let start = Date.now();
    let res = await service.ageExtension(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    for (let i = 0; i < 2; i += 1) {
      await wait(55);

      start = Date.now();
      res = await service.ageExtension(10);
      diff = Date.now() - start;
      assert(diff < this.baseLatency);
      assert(res === 30);
    }

    await wait(210);
    start = Date.now();
    res = await service.ageExtension(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async complex() {
    const service = await this.cacheService;

    const val = await service.complexInput({ a: 5, b: 20 }, 20);
    const val2 = await service.complexInput({ a: 5, b: 20 }, 20);
    assert.deepStrictEqual(val, val2);

    const val3 = await service.complexInput({ a: /abc/ }, 20);
    const val4 = await service.complexInput({ a: /cde/ }, 20);
    const val5 = await service.complexInput({ a: /abc/ }, 20);
    assert(val3 !== val4);
    assert.deepStrictEqual(val3, val5);

    assert(CacheUtil.toSafeJSON(/abc/) !== CacheUtil.toSafeJSON(/cde/));
  }

  @Test()
  async customKey() {
    const service = await this.cacheService;

    const val4 = await service.customKey({ a: 5, b: 20 }, 20);
    const val5 = await service.customKey({ b: 5, a: 20 }, 30);
    assert(val4 !== val5);

    const val6 = await service.customKey({ a: 5, b: 100 }, 50);
    assert.deepStrictEqual(val4, val6);
  }

  // @Test()
  // async culling() {
  //   const service = await this.cacheService;

  //   if (this.service instanceof CullableCacheSource) {
  //     await Promise.all(
  //       ' '.repeat(100)
  //         .split('')
  //         .map((x, i) =>
  //           service.cullable(i)));

  //     const local = service.source as CullableCacheSource;
  //     assert([...(await local.keys())].length > 90);

  //     await wait(1000);

  //     await local.cull(true);
  //     assert([...(await local.keys())].length === 0);
  //   }
  // }

  @Test()
  async reinstating() {
    const service = await this.cacheService;

    const user = await service.getUser('200');
    assert(user instanceof User);
    const user2 = await service.getUser('200');
    assert(user2 instanceof User);
    assert(user !== user2);
  }

  @Test()
  async eviction() {
    const service = await this.cacheService;

    await service.getUser('200');
    const start = Date.now();
    await service.getUser('200');
    assert((Date.now() - start) <= this.baseLatency);

    await service.deleteUser('200');
    const start2 = Date.now();
    await service.getUser('200');
    assert((Date.now() - start2) >= this.baseLatency);
  }
}