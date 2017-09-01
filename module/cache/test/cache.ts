import 'mocha';

import { timeout } from '@encore/test';
import { Cacheable, CacheManager } from '../src';
import { expect } from 'chai';
import { Shutdown } from '@encore/lifecycle';
import { Injectable, Registry } from '@encore/di';

@Injectable()
class TestCache extends CacheManager {
  constructor(shutdown: Shutdown) {
    super(shutdown);
  }
}

@Injectable()
class Test {

  constructor(public cache: TestCache) { }

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

describe('Cacheable Test', () => {
  beforeEach(async () => {
    let test = await Registry.getInstance(Test);
    test.cache.cleanup();
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  it('Testing basic', timeout(30 * 1000, async () => {
    let test = await Registry.getInstance(Test);

    let start = Date.now();
    let res = await test.youngAndComplex(10);
    let diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);

    start = Date.now();
    res = await test.youngAndComplex(10);
    diff = Date.now() - start;
    expect(diff).to.be.lessThan(105);
    expect(res).to.equal(30);
  }));

  it('Testing age', timeout(30 * 1000, async () => {
    let test = await Registry.getInstance(Test);

    let start = Date.now();
    let res = await test.youngAndComplex(10);
    let diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);

    await new Promise(resolve => setTimeout(resolve, 1000));

    start = Date.now();
    res = await test.youngAndComplex(10);
    diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);
  }));

  it('Testing size', timeout(30 * 1000, async () => {
    let test = await Registry.getInstance(Test);


    for (let y of [1, 2]) {
      for (let x of [1, 2, 3, 4, 5, 6]) {
        let start = Date.now();
        let res = await test.smallAndComplex(x);
        let diff = Date.now() - start;
        expect(diff).to.be.greaterThan(100);
        expect(res).to.equal(x * 2);
      }
    }
  }));

  it('Testing complex', timeout(30 * 1000, async () => {
    let test = await Registry.getInstance(Test);

    let val = test.complexInput({ a: 5, b: 20 }, 20);
    let val2 = test.complexInput({ a: 5, b: 20 }, 20);
    let val3 = test.complexInput({ b: 5, a: 20 }, 20);
    expect(val === val2).to.be.true;
    expect(val === val3).to.be.false;

    let val4 = test.complexInputWithCustomKey({ a: 5, b: 20 }, 20);
    let val5 = test.complexInputWithCustomKey({ b: 5, a: 20 }, 30);
    expect(val4 === val5).to.be.true;
  }));
});