import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('noTimestamp')
class NoTimestampTests {

  @Test('should exclude')
  async testExclude() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await jwt.sign({ foo: 123, exp: now + 300 }, { key: '123', iatExclude: true });
    const result = await jwt.verify(token, { key: '123' });
    assert(result.exp === now + (5 * 60));
    assert(result.iat === undefined);
  }

  @Test('shouldn\'t exclude')
  async testInclude() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await jwt.sign({ foo: 123, exp: now + 300 }, { key: '123', iatExclude: false });
    const result = await jwt.verify(token, { key: '123' });
    assert(result.exp === now + (5 * 60));
    assert(result.iat !== undefined);
    assert((result.iat! + 300) === result.exp);
  }

  @Test('shouldn\'t exclude, implicit')
  async testIncludeImplicit() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await jwt.sign({ foo: 123, exp: now + 300 }, { key: '123' });
    const result = await jwt.verify(token, { key: '123' });
    assert(result.exp === now + (5 * 60));
    assert(result.iat !== undefined);
    assert((result.iat! + 300) === result.exp);
  }
}