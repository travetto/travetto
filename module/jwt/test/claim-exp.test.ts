import * as assert from 'assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';

import { JWTUtil } from '..';
import { JWTError } from '../src/error';

const noneAlgorithmHeader = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0';

@Suite('expires')
export class ExpiresSuite {

  @Test('"exp" in payload validation')
  async testInvalidPayload() {
    for (const exp of [
      true,
      false,
      null,
      -Infinity,
      Infinity,
      NaN,
      '',
      ' ',
      'invalid',
      [],
      ['foo'],
      {},
      { foo: 'bar' },
    ]) {
      const encodedPayload = Buffer.from(JSON.stringify({ exp })).toString('base64');
      const token = `${noneAlgorithmHeader}.${encodedPayload}.`;
      await assert.rejects(() => JWTUtil.verify(token, { alg: 'none' }), JWTError);
    }
  }

  @Test('should set correct "exp" with negative number of seconds')
  async testNegativeExp() {
    const start = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: start - 10 }, { alg: 'none' });

    const { payload: decoded } = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token, { clock: { timestamp: start - 20000 } });
    assert.deepEqual(decoded, verified);
    assert(decoded.exp === start - 10);
  }

  @Test('should set correct "exp" with positive number of seconds')
  async testPositive() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now + 10 }, { alg: 'none' });

    const { payload: decoded } = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token);
    assert.deepEqual(decoded, verified);
    assert(decoded.exp === now + 10);
  }

  @Test('should set correct "exp" with zero seconds')
  async testZero() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now }, { alg: 'none' });

    const { payload: decoded } = JWTUtil.read(token);
    const verified = await JWTUtil.verify(token, { clock: { timestamp: now - 1 } });
    assert.deepEqual(decoded, verified);
    assert(decoded.exp === now);
  }

  @Test('should verify "exp" using "clockTimestamp"')
  async testTimestamp() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now + 10 }, { alg: 'none' });

    const verified = await JWTUtil.verify(token, { clock: { timestamp: now + 5 } });
    assert(verified.iat === now);
    assert(verified.exp === now + 10);
  }

  @Test('should verify "exp" using "clockTolerance"')
  async testTolerance() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now + 5 }, { alg: 'none' });

    const verified = await JWTUtil.verify(token, { clock: { timestamp: now, tolerance: 6 } });
    assert(verified.iat === now);
    assert(verified.exp === now + 5);
  }

  @Test('should ignore a expired token when "ignoreExpiration" is true')
  async testIgnoreExp() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now - 10 }, { alg: 'none' });

    const verified = await JWTUtil.verify(token, { ignore: { exp: true } });
    assert(verified.iat === now);
    assert(verified.exp === now - 10);
  }

  @Test('should error on verify if "exp" is at current time')
  @ShouldThrow('expired')
  async testExpIsNow() {
    const now = Math.trunc(Date.now() / 1000);
    const token = await JWTUtil.create({ exp: now }, { alg: 'none' });

    await JWTUtil.verify(token);
  }

  @Test('should error on verify if "exp" is before current time using clockTolerance')
  @ShouldThrow('expired')
  async test() {
    const now = Math.trunc(Date.now() / 1000);

    const token = await JWTUtil.create({ exp: now - 5 }, { alg: 'none' });

    await JWTUtil.verify(token, { clock: { tolerance: 5 } });
  }
}
