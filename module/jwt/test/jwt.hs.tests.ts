import * as assert from 'assert';

import { Suite, Test, ShouldThrow, BeforeEach } from '@travetto/test';

import * as jwt from '..';

@Suite('HS256')
class HS256Suite {

  private secret = 'shhhhhh';

  private token: string;

  @BeforeEach()
  async init() {
    this.token = await jwt.sign({ foo: 'bar' }, { key: this.secret, alg: 'HS256' });
  }

  @Test('should be syntactically valid')
  async testVavlid() {
    assert(typeof this.token === 'string');
    assert(this.token.split('.').length === 3);
  }

  @Test('should be able to validate without options')
  async testValidate() {
    const decoded = await jwt.verify(this.token, { key: this.secret });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should validate with secret')
  async testSecret() {
    const decoded = await jwt.verify(this.token, { key: this.secret });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should throw with invalid secret')
  @ShouldThrow(jwt.JWTError)
  async testBadSecret() {
    const decoded = await jwt.verify(this.token, { key: 'invalid secret' });
  }

  @Test('should throw with secret and token not signed')
  @ShouldThrow(jwt.JWTError)
  async testUnsigned() {
    const signed = await jwt.sign({ foo: 'bar' }, { key: this.secret, alg: 'none' });
    const [h, p, s] = signed.split('.');
    const unsigned = `${h}.${p}.`;
    await jwt.verify(unsigned, { key: 'secret' });
  }

  @Test('should work with falsy secret and token not signed')
  @ShouldThrow(jwt.JWTError)
  async testNoSig() {
    const signed = await jwt.sign({ foo: 'bar' }, { alg: 'none' });
    const [h, p, s] = signed.split('.');
    const unsigned = `${h}.${p}.`;
    await jwt.verify(unsigned, { key: 'secret' });
  }

  @Test('should return an error when the token is expired')
  @ShouldThrow(jwt.JWTError)
  async testExpired() {
    const token = await jwt.sign({ exp: 1 }, { key: this.secret, alg: 'HS256' });
    await jwt.verify(token, { key: this.secret, alg: 'HS256' });
  }

  @Test('should NOT return an error when the token is expired with "ignoreExpiration"')
  async testIgnoreExp() {
    const token = await jwt.sign({ exp: 1, foo: 'bar' }, { key: this.secret, alg: 'HS256' });
    const decoded = await jwt.verify(token, { key: this.secret, alg: 'HS256', ignore: { exp: true } });
    assert(!!decoded.foo);
    assert('bar' === decoded.foo);
  }

  @Test('should default to HS256 algorithm when no options are passed')
  async testAlgo() {
    const token = await jwt.sign({ foo: 'bar' }, { key: this.secret });
    const verifiedToken = await jwt.verify(token, { key: this.secret });
    assert(!!verifiedToken.foo);
    assert('bar' === verifiedToken.foo);
  }

  @Test('should return the "invalid token" error')
  @ShouldThrow(jwt.JWTError)
  async testInvalid() {
    const malformedToken = `${this.token} `; // corrupt the token by adding a space
    await jwt.verify(malformedToken, { key: this.secret, alg: 'HS256', ignore: { exp: true } });
  }
}
