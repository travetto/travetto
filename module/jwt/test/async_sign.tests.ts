import * as assert from 'assert';

import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

const key = 'shhhhhh';

@Suite('signing a token asynchronously')
class AsyncSignTest {

  @Test('should work with empty options')
  async testEmptyOptions() {
    const res = await jwt.sign({ abc: 1 }, { key: 'secret' });
  }

  @Test('should work with none algorithm where secret is set')
  async testAlgoNone() {
    const token = await jwt.sign({ foo: 'bar' }, { key: 'secret', alg: 'none' });
    assert(typeof token === 'string');
    assert(token.split('.').length === 3);
  }

  @Test('should return error when secret is not a cert for RS256')
  @ShouldThrow(jwt.JWTError)
  async testCert() {
    await jwt.sign({ foo: 'bar' }, { key, alg: 'RS256' });
  }

  @Test('should return error on wrong arguments')
  @ShouldThrow(jwt.JWTError)
  async testBadArgs() {
    // this throw an error because the secret is not a cert and RS256 requires a cert.
    await jwt.sign({ foo: 'bar' }, { key, alg: 'RS256', payload: { nbf: -1 } });
  }

  @Test('should not apply claims to the original payload object (mutatePayload defaults to false)')
  async testClaimsImmutable() {
    const originalPayload: { [key: string]: any } = { foo: 'bar' };
    await jwt.sign(originalPayload, { key, payload: { nbf: 60, exp: 600 } });
    assert(originalPayload.nbf === undefined);
    assert(originalPayload.exp === undefined);
  }
}