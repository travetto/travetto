import { Cacheable, CacheManager } from '../src';
import { Shutdown } from '@travetto/base';
import { Suite, Test, BeforeEach } from '@travetto/test';
import { assert } from 'console';

class CachingService {

  @Cacheable({
    max: 5
  })
  async smallAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 2;
  }

  @Cacheable({
    maxAge: 1000
  })
  async youngAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 3;
  }

  @Cacheable({
    max: 1000
  })
  async complexInput(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }

  @Cacheable({ max: 1000 }, config => config.a)
  async complexInputWithCustomKey(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }
}

@Suite()
class TestSuite {

  @BeforeEach()
  async cleanup() {
    CacheManager.cleanup();
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  @Test()
  async basic() {
    const test = new CachingService();

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
    const test = new CachingService();

    let start = Date.now();
    let res = await test.youngAndComplex(10);
    let diff = Date.now() - start;
    assert(diff > 100);
    assert(res === 30);

    await new Promise(resolve => setTimeout(resolve, 1000));

    start = Date.now();
    res = await test.youngAndComplex(10);
    diff = Date.now() - start;
    assert(diff > 100);
    assert(res === 30);
  }

  @Test()
  async size() {
    const test = new CachingService();


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
    const test = new CachingService();

    const val = test.complexInput({ a: 5, b: 20 }, 20);
    const val2 = test.complexInput({ a: 5, b: 20 }, 20);
    const val3 = test.complexInput({ b: 5, a: 20 }, 20);
    assert(val === val2);
    assert(val !== val3);

    const val4 = test.complexInputWithCustomKey({ a: 5, b: 20 }, 20);
    const val5 = test.complexInputWithCustomKey({ b: 5, a: 20 }, 30);
    assert(val4 === val5);
  }
}