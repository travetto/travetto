import { timeout } from '@encore/test';
import { Cacheable, CacheService } from '../lib';
import { expect } from 'chai';

class Test {
  @Cacheable({
    max: 5
  })
  static async smallAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 2;
  }

  @Cacheable({
    maxAge: 1000
  })
  static async youngAndComplex(num: number) {
    await new Promise(resolve => setTimeout(resolve, 105));
    return num * 3;
  }

  @Cacheable({
    max: 1000
  })
  static async complexInput(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }

  @Cacheable({ max: 1000 }, config => config.a)
  static async complexInputWithCustomKey(config: any, size: number) {
    return { length: Object.keys(config).length, size };
  }
}

describe('Cacheable Test', () => {
  beforeEach((done) => {
    CacheService.clear();
    setTimeout(done, 200);
  });

  it('Testing basic', timeout(30 * 1000, async () => {
    let start = Date.now();
    let res = await Test.youngAndComplex(10);
    let diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);

    start = Date.now();
    res = await Test.youngAndComplex(10);
    diff = Date.now() - start;
    expect(diff).to.be.lessThan(100);
    expect(res).to.equal(30);
  }));

  it('Testing age', timeout(30 * 1000, async () => {
    let start = Date.now();
    let res = await Test.youngAndComplex(10);
    let diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);

    await new Promise(resolve => setTimeout(resolve, 1000));

    start = Date.now();
    res = await Test.youngAndComplex(10);
    diff = Date.now() - start;
    expect(diff).to.be.greaterThan(100);
    expect(res).to.equal(30);
  }));

  it('Testing size', timeout(30 * 1000, async () => {
    for (let y of [1, 2]) {
      for (let x of [1, 2, 3, 4, 5, 6]) {
        let start = Date.now();
        let res = await Test.smallAndComplex(x);
        let diff = Date.now() - start;
        expect(diff).to.be.greaterThan(100);
        expect(res).to.equal(x * 2);
      }
    }
  }));

  it('Testing complex', timeout(30 * 1000, async () => {
    let val = Test.complexInput({ a: 5, b: 20 }, 20);
    let val2 = Test.complexInput({ a: 5, b: 20 }, 20);
    let val3 = Test.complexInput({ b: 5, a: 20 }, 20);
    expect(val === val2).to.be.true;
    expect(val === val3).to.be.false;

    let val4 = Test.complexInputWithCustomKey({ a: 5, b: 20 }, 20);
    let val5 = Test.complexInputWithCustomKey({ b: 5, a: 20 }, 30);
    expect(val4 === val5).to.be.true;
  }));
});