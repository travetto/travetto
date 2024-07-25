import { sign } from 'jws';
import assert from 'node:assert';

import { Suite, Test, ShouldThrow, TestFixtures } from '@travetto/test';
import { TimeUtil } from '@travetto/runtime';

import { JWTUtil } from '../src/util';
import { JWTError } from '../src/error';

@Suite('verify')
class VerifySuite {

  fixture = new TestFixtures();

  @Test('should first assume JSON claim set')
  async simpleVerify() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const priv = await this.fixture.read('/priv.pem', true);
    const pub = await this.fixture.read('/pub.pem', true);

    const signed = sign({
      header: { alg: 'RS256', typ: 'JWT' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const res = await JWTUtil.verify(signed, { key: pub, alg: 'RS256' });
    assert.deepEqual(res, payload);
  }

  @Test('should allow for multiple keys, anyone could succeed')
  async multiRSAVerify() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const priv = await this.fixture.read('/priv.pem', true);
    const pub = await this.fixture.read('/pub.pem', true);
    const expiredPub = await this.fixture.read('/invalid_pub.pem', true);

    const signed = sign({
      header: { alg: 'RS256', typ: 'JWT' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const res = await JWTUtil.verify(signed, { key: [expiredPub, pub], alg: 'RS256' });
    assert.deepEqual(res, payload);
  }

  @Test('should allow for multiple keys, anyone could succeed')
  async multiVerifySymmetric() {
    const payload = { iat: Math.floor(Date.now() / 1000) };

    const signed = sign({
      header: { alg: 'HS256', typ: 'JWT' },
      payload,
      secret: 'test',
      encoding: 'utf8'
    });

    const res = await JWTUtil.verify(signed, { key: ['toast', 'most', 'mest', 'test'] });
    assert.deepEqual(res, payload);
  }

  @Test('should be able to validate unsigned token')
  async validateUnsigned() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const priv = await this.fixture.read('/priv.pem', true);

    const signed = sign({
      header: { alg: 'none' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const p = await JWTUtil.verify(signed, { alg: 'none' });
    assert.deepEqual(p, payload);
  }

  @Test('should not mutate options')
  async noMutate() {
    const priv = await this.fixture.read('/priv.pem', true);

    const payload = { iat: Math.floor(Date.now() / 1000) };

    const signed = sign({
      header: { alg: 'none' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const options = { alg: 'none' } as const;
    await JWTUtil.verify(signed, options);
    assert.deepEqual(Object.keys(options).length, 1);
  }

  @Test('secret or token as Promise')
  async testPromiseKey() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MzcwMTg1ODIsImV4cCI6MTQzNzAxODU5Mn0.3aR3vocmgRpG05rsI9MpR6z2T_BGtMQaPq2YR6QaroU';
    const key = 'key';

    const payload = { foo: 'bar', iat: 1437018582, exp: 1437018592 };
    const options = { alg: 'HS256', ignore: { exp: true }, key } as const;

    const p = await JWTUtil.verify(token, options);
    assert.deepEqual(p, payload);

    const p2 = await JWTUtil.verify(token, { ...options, key: Promise.resolve(key) });
    assert.deepEqual(p2, payload);

    await assert.rejects(
      () => JWTUtil.verify(token, { ...options, key: Promise.reject(new Error('key not found')) }),
      'key not found');
  }
}

@Suite('verify expiration')
class VerifyExpirationSuite {
  // { foo: 'bar', iat: 1437018582, exp: 1437018592 }
  token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MzcwMTg1ODIsImV4cCI6MTQzNzAxODU5Mn0.3aR3vocmgRpG05rsI9MpR6z2T_BGtMQaPq2YR6QaroU';
  key = 'key';

  @Test('should error on expired token')
  async verifyExpired() {
    // clock = sinon.useFakeTimers(1437018650000); // iat + 58s, exp + 48s
    const options = { key: this.key, alg: 'HS256' } as const;
    try {
      await JWTUtil.verify(this.token, options);
    } catch (err: unknown) {
      assert(err instanceof JWTError);
      assert(err.message === 'Token is expired');
      assert(err.details);
      assert(err.details.expiredAt);
      assert(TimeUtil.asSeconds(err.details.expiredAt) === 1437018592);
    }
  }

  @Test('should not error on expired token within clockTolerance interval')
  async verifyTolerance() {
    // clock = sinon.useFakeTimers(1437018594000); // iat + 12s, exp + 2s
    const options = { key: this.key, alg: 'HS256', clock: { timestamp: new Date(1437018594000), tolerance: 5 } } as const;

    const res = await JWTUtil.verify(this.token, options);
    assert(res.foo === 'bar');
  }

  // describe('option: clockTimestamp', function() {
  //   var clockTimestamp = 1000000000;

  @Test('clockTimestamp - should verify unexpired token relative to user-provided clockTimestamp')
  async testStampValid() {
    const clockTimestamp = 1000000000;
    const token = await JWTUtil.create({ foo: 'bar', iat: clockTimestamp, exp: clockTimestamp + 1 }, { key: this.key });
    await JWTUtil.verify(token, { key: this.key, clock: { timestamp: clockTimestamp } });
  }

  @Test('clockTimestamp - should error on expired token relative to user-provided clockTimestamp')
  @ShouldThrow('expired')
  async testStampInvalid() {
    const clockTimestamp = 10000000000;
    const token = await JWTUtil.create({ foo: 'bar', iat: clockTimestamp + 1, exp: 1 }, { key: this.key });
    await JWTUtil.verify(token, { key: this.key, clock: { timestamp: clockTimestamp } });
  }

  @Test('option: maxAge and clockTimestamp')
  async testMaxAge() {
    // { foo: 'bar', iat: 1437018582, exp: 1437018800 } exp = iat + 218s
    const issuedAt = 1437018582;
    const maxAgeSec = TimeUtil.asSeconds(218, 's');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MzcwMTg1ODIsImV4cCI6MTQzNzAxODgwMH0.AVOsNC7TiT-XVSpCpkwB1240izzCIJ33Lp07gjnXVpA';
    const clockTimestamp = 1437018900;  // iat + 318s (exp: iat + 218s)
    const options = { key: this.key, alg: 'HS256', clock: { timestamp: clockTimestamp }, maxAgeSec } as const;

    try {
      await JWTUtil.verify(token, options);
    } catch (err) {
      // maxAge not exceeded, but still expired
      assert(err instanceof JWTError);
      assert(err.message === 'Token is expired');
      assert(err.details.expiredAt);
      assert(TimeUtil.asSeconds(err.details.expiredAt) === (issuedAt + maxAgeSec));
    }
  }
}
