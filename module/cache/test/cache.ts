import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Cache } from '../src/decorator';
import { MemoryCacheStore } from '../src/store/memory';

class CachingService {

  store = new MemoryCacheStore();

  @Cache('store')
  async smallAndComplex(num: number) {
    return num * 2;
  }

  @Cache('store')
  async youngAndComplex(num: number) {
    return num * 3;
  }

  @Cache('store')
  async complexInput(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }

  @Cache('store', { keyFn: config => config.a })
  async complexInputWithCustomKey(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }
}

@Suite()
class TestSuite {

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