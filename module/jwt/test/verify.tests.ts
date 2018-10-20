import * as jws from 'jws';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';
import { VerifyOptions } from '../src/types';
import { JWTError } from '../src/common';

const readFile = util.promisify(fs.readFile);
const pubKey = path.join(__dirname, 'pub.pem');
const privKey = path.join(__dirname, 'priv.pem');

@Suite('verify')
class VerifySuite {

  @Test('should first assume JSON claim set')
  async simpleVerify() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const priv = await readFile(privKey);
    const pub = await readFile(pubKey);

    const signed = jws.sign({
      header: { alg: 'RS256', typ: 'JWT' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const res = await jwt.verify(signed, { key: pub, alg: 'RS256' });
    assert.deepEqual(res, payload);
  }

  @Test('should be able to validate unsigned token')
  async validateUnsigned() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const priv = await readFile(privKey);

    const signed = jws.sign({
      header: { alg: 'none' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const p = await jwt.verify(signed, { alg: 'none' });
    assert.deepEqual(p, payload);
  }

  @Test('should not mutate options')
  async noMutate() {
    const priv = await readFile(privKey);

    const payload = { iat: Math.floor(Date.now() / 1000) };

    const signed = jws.sign({
      header: { alg: 'none' },
      payload,
      secret: priv,
      encoding: 'utf8'
    });

    const options: VerifyOptions = {
      alg: 'none'
    };
    await jwt.verify(signed, options);
    assert.deepEqual(Object.keys(options).length, 1);
  }

  @Test('secret or token as Promise')
  async testPromiseKey() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MzcwMTg1ODIsImV4cCI6MTQzNzAxODU5Mn0.3aR3vocmgRpG05rsI9MpR6z2T_BGtMQaPq2YR6QaroU';
    const key = 'key';

    const payload = { foo: 'bar', iat: 1437018582, exp: 1437018592 };
    const options: VerifyOptions = { alg: 'HS256', ignore: { exp: true }, key };

    const p = await jwt.verify(token, options);
    assert.deepEqual(p, payload);

    const p2 = await jwt.verify(token, { ...options, key: Promise.resolve(key) });
    assert.deepEqual(p2, payload);

    assert.throws(() =>
      jwt.verify(token, { ...options, key: Promise.reject('key not found') })
      , jwt.JWTError);
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
    const options: VerifyOptions = { key: this.key, alg: 'HS256' };
    try {
      await jwt.verify(this.token, options);
    } catch (err) {
      assert(err instanceof JWTError);
      assert(err.message === 'expired');
      assert(!!err.payload);
      assert(!!err.payload.expiredAt);
      assert(+err.payload.expiredAt === 1437018592000);
    }
  }

  @Test('should not error on expired token within clockTolerance interval')
  async verifyTolerance() {
    // clock = sinon.useFakeTimers(1437018594000); // iat + 12s, exp + 2s
    const options: VerifyOptions = { key: this.key, alg: ['HS256'], clock: { timestamp: new Date(1437018594000), tolerance: 5 } };

    const res = await jwt.verify(this.token, options);
    assert(res.foo === 'bar');
  }

  // describe('option: clockTimestamp', function() {
  //   var clockTimestamp = 1000000000;

  @Test('clockTimestamp - should verify unexpired token relative to user-provided clockTimestamp')
  async testStampValid() {
    const clockTimestamp = 1000000000;
    const token = await jwt.sign({ foo: 'bar', iat: clockTimestamp, exp: clockTimestamp + 1 }, { key: this.key });
    await jwt.verify(token, { key: this.key, clock: { timestamp: clockTimestamp } });
  }

  @Test('clockTimestamp - should error on expired token relative to user-provided clockTimestamp')
  @ShouldThrow('expired')
  async testStampInvalid() {
    const clockTimestamp = 10000000000;
    const token = await jwt.sign({ foo: 'bar', iat: clockTimestamp + 1, exp: 1 }, { key: this.key });
    await jwt.verify(token, { key: this.key, clock: { timestamp: clockTimestamp } });
  }

  @Test('option: maxAge and clockTimestamp')
  async testMaxAge() {
    // { foo: 'bar', iat: 1437018582, exp: 1437018800 } exp = iat + 218s
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjE0MzcwMTg1ODIsImV4cCI6MTQzNzAxODgwMH0.AVOsNC7TiT-XVSpCpkwB1240izzCIJ33Lp07gjnXVpA';
    const clockTimestamp = 1437018900;  // iat + 318s (exp: iat + 218s)
    const options: VerifyOptions = {
      key: this.key, alg: 'HS256', clock: { timestamp: clockTimestamp }, maxAgeSec: 60 * 60 * 24 * 365 * 1000
    };

    try {
      await jwt.verify(token, options);
    } catch (err) {
      // maxAge not exceded, but still expired
      assert(err instanceof JWTError);
      assert(err.message === 'expired');
      assert(err.payload.expiredAt === 1437018800000);
    }
  }
}
