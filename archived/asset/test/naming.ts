import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { StreamMeta } from '@travetto/model';
import { asFull } from '@travetto/runtime';

import { SimpleNamingStrategy, HashNamingStrategy } from '../src/naming';

@Suite()
export class NamingStrategyTest {
  @Test()
  testSimple() {
    const strategy = new SimpleNamingStrategy();
    const resolved = strategy.resolve(asFull<StreamMeta>({
      filename: 'orange'
    }));
    assert(resolved === 'orange');

    const strategy2 = new SimpleNamingStrategy('/test');
    const resolved2 = strategy2.resolve(asFull<StreamMeta>({
      filename: '/orange'
    }));
    assert(resolved2 === '/test/orange');

    const strategy3 = new SimpleNamingStrategy('/test/');
    const resolved3 = strategy3.resolve(asFull<StreamMeta>({
      filename: '/orange'
    }));
    assert(resolved3 === '/test//orange');
  }

  @Test()
  testHash() {
    const strategy = new HashNamingStrategy();
    const resolved = strategy.resolve(asFull<StreamMeta>({
      filename: 'orange',
      contentType: 'image/jpeg',
      hash: 'bar-car-fly-extra'
    }));
    assert(resolved === 'bar-/car-/fly-/extr/a.jpeg');
  }
}