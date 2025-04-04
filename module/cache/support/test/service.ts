import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { ModelExpirySupport, ModelIndexedUtil } from '@travetto/model';
import { Inject, Injectable } from '@travetto/di';
import { castTo, Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';

import { Cache, EvictCache } from '../../src/decorator.ts';
import { CacheService } from '../../src/service.ts';
import { CacheModelSymbol } from '../../src/types.ts';

@Schema()
class User { }

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
    await timers.setTimeout(100);
    return num * 2;
  }

  @Cache('source', '.5s')
  async agesQuickly(num: number) {
    await timers.setTimeout(100);
    return num * 3;
  }

  @Cache('source', 200, { extendOnAccess: true })
  async ageExtension(num: number) {
    await timers.setTimeout(100);
    return num * 3;
  }

  @Cache('source')
  async complexInput(config: object, size: number) {
    await timers.setTimeout(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('source', { key: config => config.a })
  async customKey(config: object, size: number) {
    await timers.setTimeout(100);
    return { length: Object.keys(config).length, size };
  }

  @Cache('source', { keySpace: 'user.id', reinstate: x => User.from(castTo(x)) })
  async getUser(userId: string) {
    await timers.setTimeout(105);

    return {
      id: userId,
      date: Date.now()
    };
  }

  @EvictCache('source', { keySpace: 'user.id' })
  async deleteUser(userId: string) {
    await timers.setTimeout(100);
    return true;
  }

  async deleteAllUsers() {
    this.source.deleteAll('user.id');
    await timers.setTimeout(100);
    return true;
  }
}

@Suite()
@ModelSuite(CacheModelSymbol)
@InjectableSuite()
export abstract class CacheServiceSuite {

  serviceClass: Class<ModelExpirySupport>;
  configClass: Class;

  baseLatency = 10;

  @Inject()
  testService: SampleService;

  @Test()
  async basic() {
    const service = await this.testService;
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
    const service = await this.testService;

    let start = Date.now();
    let res = await service.agesQuickly(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    await timers.setTimeout(510);

    start = Date.now();
    res = await service.agesQuickly(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async ageWithExtension() {
    const service = await this.testService;

    let start = Date.now();
    let res = await service.ageExtension(10);
    let diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);

    for (let i = 0; i < 2; i += 1) {
      await timers.setTimeout(55);

      start = Date.now();
      res = await service.ageExtension(10);
      diff = Date.now() - start;
      assert(diff < (100 + this.baseLatency));
      assert(res === 30);
    }

    await timers.setTimeout(210);
    start = Date.now();
    res = await service.ageExtension(10);
    diff = Date.now() - start;
    assert(diff > 75);
    assert(res === 30);
  }

  @Test()
  async complex() {
    const service = await this.testService;

    const val = await service.complexInput({ a: 5, b: 20 }, 20);
    const val2 = await service.complexInput({ a: 5, b: 20 }, 20);
    assert.deepStrictEqual(val, val2);

    const val3 = await service.complexInput({ a: /abc/ }, 20);
    const val4 = await service.complexInput({ a: /cde/ }, 20);
    const val5 = await service.complexInput({ a: /abc/ }, 20);
    assert(val3 !== val4);
    assert.deepStrictEqual(val3, val5);
  }

  @Test()
  async customKey() {
    const service = await this.testService;

    const val4 = await service.customKey({ a: 5, b: 20 }, 20);
    const val5 = await service.customKey({ b: 5, a: 20 }, 30);
    assert(val4 !== val5);

    const val6 = await service.customKey({ a: 5, b: 100 }, 50);
    assert.deepStrictEqual(val4, val6);
  }

  @Test()
  async reinstating() {
    const service = await this.testService;

    const user = await service.getUser('200');
    assert(user instanceof User);
    const user2 = await service.getUser('200');
    assert(user2 instanceof User);
    assert(user !== user2);
  }

  @Test()
  async eviction() {
    const service = await this.testService;

    await service.getUser('200');
    const start = Date.now();
    await service.getUser('200');
    assert((Date.now() - start) <= (this.baseLatency + 100));

    await service.deleteUser('200');
    const start2 = Date.now();
    await service.getUser('200');
    assert((Date.now() - start2) >= 100);

    // First time is free
    await service.deleteUser('200');

    await assert.doesNotReject(() => service.deleteUser('200'));
  }

  @Test()
  async allEviction() {
    if (!ModelIndexedUtil.isSupported(this.serviceClass.prototype)) {
      return;
    }

    const service = await this.testService;

    // Prime cache
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await service.getUser(`${i}`);
      assert((Date.now() - start) >= 100);
    }

    // Read cache
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await service.getUser(`${i}`);
      assert((Date.now() - start) <= (this.baseLatency + 100));
    }

    await service.deleteAllUsers();

    // Prime cache
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await service.getUser(`${i}`);
      assert((Date.now() - start) >= 100);
    }

    // Read cache
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await service.getUser(`${i}`);
      assert((Date.now() - start) <= (this.baseLatency + 100));
    }
  }
}