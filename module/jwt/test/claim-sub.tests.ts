import * as assert from 'assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('subject')
class SuiteTest {

  @Test('should verify with a string "subject"')
  async testVerify() {
    const token = await JWTUtil.create({ sub: 'foo' }, { alg: 'none' });
    const decoded = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token, { alg: 'none', payload: { sub: 'foo' } });
    assert.deepStrictEqual(decoded, verified);
    assert(decoded.sub === 'foo');
  }

  @Test('should verify with a string "sub"')
  async testVerify2() {
    const token = await JWTUtil.create({ sub: 'foo' }, { alg: 'none' });
    const decoded = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token, { alg: 'none', payload: { sub: 'foo' } });
    assert.deepStrictEqual(decoded, verified);
    assert(decoded.sub === 'foo');
  }

  @Test('should not verify "sub" if "verify.subject" option not provided')
  async tetVerify3() {
    const token = await JWTUtil.create({ sub: 'foo' }, { alg: 'none' });
    const decoded = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token, { alg: 'none' });
    assert.deepStrictEqual(decoded, verified);
    assert(decoded.sub === 'foo');
  }

  @Test('should error if "sub" does not match "verify.subject" option')
  @ShouldThrow(JWTError)
  async matchSub() {
    const token = await JWTUtil.create({ sub: 'foo' });
    await JWTUtil.verify(token, { payload: { sub: 'bar' } });
  }

  @Test('should error without "sub" and with "verify.subject" option')
  @ShouldThrow(JWTError)
  async errorOnMissing() {
    const token = await JWTUtil.create({});
    await JWTUtil.verify(token, { payload: { sub: 'foo' } });
  }
}