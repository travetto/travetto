import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { StreamMeta } from '@travetto/model';

import { SimpleNamingStrategy, HashNamingStrategy } from '../src/naming';

@Suite()
export class NamingStrategyTest {
  @Test()
  testSimple() {
    const strategy = new SimpleNamingStrategy();
    const resolved = strategy.resolve({
      filename: 'orange'
    } as StreamMeta);
    assert(resolved === 'orange');

    const strategy2 = new SimpleNamingStrategy('/test');
    const resolved2 = strategy2.resolve({
      filename: '/orange'
    } as StreamMeta);
    assert(resolved2 === '/test/orange');

    const strategy3 = new SimpleNamingStrategy('/test/');
    const resolved3 = strategy3.resolve({
      filename: '/orange'
    } as StreamMeta);
    assert(resolved3 === '/test//orange');
  }

  @Test()
  testHash() {
    const strategy = new HashNamingStrategy();
    const resolved = strategy.resolve({
      filename: 'orange',
      contentType: 'image/jpeg',
      hash: 'banana-tomato-okextra'
    } as StreamMeta);
    assert(resolved === 'bana/na-t/omat/o-ok/extra.jpeg');
  }
}