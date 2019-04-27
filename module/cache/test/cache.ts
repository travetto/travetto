import * as assert from 'assert';

import { Suite, Test, BeforeAll, AfterEach } from '@travetto/test';
import { Injectable, Inject, DependencyRegistry } from '@travetto/di';

import { CacheFactory } from '../src/service';
import { Cacheable } from '../src/decorator';

@Injectable()
class CachingService {

  @Inject()
  cache: CacheFactory;

  @Cacheable({
    max: 5,
    dispose: (v: any, k: string, ) => {

    }
  })
  async smallAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 2;
  }

  @Cacheable({ ttl: 1000 })
  async youngAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 3;
  }

  @Cacheable({ max: 1000 })
  async complexInput(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }

  @Cacheable({ max: 1000, keyFn: (config) => config.a })
  async complexInputWithCustomKey(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }
}

@Suite()
class TestSuite {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @AfterEach()
  async cleanup() {
    const cf = await DependencyRegistry.getInstance(CacheFactory);
    await cf.cleanup();
  }

  @Test()
  async basic() {
    const test = await DependencyRegistry.getInstance(CachingService);

    let start = Date.now();
    let res = await test.youngAndComplex(10);
    let diff = Date.now() - start;
    assert(diff > 100);
    assert(res === 30);

    start = Date.now();
    res = await test.youngAndComplex(10);
    diff = Date.now() - start;
    assert(diff < 105);
    assert(res === 30);
  }

  @Test()
  async age() {
    const test = await DependencyRegistry.getInstance(CachingService);

    let start = Date.now();
    let res = await test.youngAndComplex(10);
    let diff = Date.now() - start;
    assert(diff > 100);
    assert(res === 30);

    await new Promise(resolve => setTimeout(resolve, 1100));

    start = Date.now();
    res = await test.youngAndComplex(10);
    diff = Date.now() - start;
    assert(res === 30);
    assert(diff > 100);
  }

  @Test()
  async size() {
    const test = await DependencyRegistry.getInstance(CachingService);

    for (const y of [1, 2]) {
      for (const x of [1, 2, 3, 4, 5, 6]) {
        const start = Date.now();
        const res = await test.smallAndComplex(x);
        const diff = Date.now() - start;
        assert(diff > 100);
        assert(res === x * 2);
      }
    }
  }

  @Test()
  async complex() {
    const test = await DependencyRegistry.getInstance(CachingService);

    const val = await test.complexInput({ a: 5, b: 20 }, 20);
    const val2 = await test.complexInput({ a: 5, b: 20 }, 20);
    const val3 = await test.complexInput({ b: 5, a: 20 }, 20);
    assert(val === val2);
    assert(val !== val3);

    const val4 = await test.complexInputWithCustomKey({ a: 5, b: 20 }, 20);
    const val5 = await test.complexInputWithCustomKey({ b: 5, a: 20 }, 30);
    assert(val4 !== val5);

    const val6 = await test.complexInputWithCustomKey({ a: 5, b: 100 }, 50);
    assert(val4 === val6);
  }
}