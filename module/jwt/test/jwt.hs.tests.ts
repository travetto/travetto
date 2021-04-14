import * as assert from 'assert';

import { Suite, Test, ShouldThrow, BeforeEach } from '@travetto/test';

import { JWTUtil } from '..';
import { JWTError } from '../src/error';

@Suite('HS256')
class HS256Suite {

  #secret = 'shhhhhh';
  #token: string;

  @BeforeEach()
  async init() {
    this.#token = await JWTUtil.create({ foo: 'bar' }, { key: this.#secret, alg: 'HS256' });
  }

  @Test('should be syntactically valid')
  async testValid() {
    assert(typeof this.#token === 'string');
    assert(this.#token.split('.').length === 3);
  }

  @Test('should be able to validate without options')
  async testValidate() {
    const decoded = await JWTUtil.verify(this.#token, { key: this.#secret });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should validate with secret')
  async testSecret() {
    const decoded = await JWTUtil.verify(this.#token, { key: this.#secret });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should throw with invalid secret')
  @ShouldThrow(JWTError)
  async testBadSecret() {
    await JWTUtil.verify(this.#token, { key: 'invalid secret' });
  }

  @Test('should throw with secret and token not signed')
  @ShouldThrow(JWTError)
  async testUnsigned() {
    const signed = await JWTUtil.create({ foo: 'bar' }, { key: this.#secret, alg: 'none' });
    const [h, p,] = signed.split('.');
    const unsigned = `${h}.${p}.`;
    await JWTUtil.verify(unsigned, { key: 'secret' });
  }

  @Test('should work with falsy secret and token not signed')
  @ShouldThrow(JWTError)
  async testNoSig() {
    const signed = await JWTUtil.create({ foo: 'bar' }, { alg: 'none' });
    const [h, p,] = signed.split('.');
    const unsigned = `${h}.${p}.`;
    await JWTUtil.verify(unsigned, { key: 'secret' });
  }

  @Test('should return an error when the token is expired')
  @ShouldThrow(JWTError)
  async testExpired() {
    const token = await JWTUtil.create({ exp: 1 }, { key: this.#secret, alg: 'HS256' });
    await JWTUtil.verify(token, { key: this.#secret, alg: 'HS256' });
  }

  @Test('should NOT return an error when the token is expired with "ignoreExpiration"')
  async testIgnoreExp() {
    const token = await JWTUtil.create({ exp: 1, foo: 'bar' }, { key: this.#secret, alg: 'HS256' });
    const decoded = await JWTUtil.verify(token, { key: this.#secret, alg: 'HS256', ignore: { exp: true } });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should default to HS256 algorithm when no options are passed')
  async testAlgo() {
    const token = await JWTUtil.create({ foo: 'bar' }, { key: this.#secret });
    const verifiedToken = await JWTUtil.verify(token, { key: this.#secret });
    assert(!!verifiedToken.foo);
    assert('bar' === verifiedToken.foo);
  }

  @Test('should return the "invalid token" error')
  @ShouldThrow(JWTError)
  async testInvalid() {
    const malformedToken = `${this.#token} `; // corrupt the token by adding a space
    await JWTUtil.verify(malformedToken, { key: this.#secret, alg: 'HS256', ignore: { exp: true } });
  }
}
