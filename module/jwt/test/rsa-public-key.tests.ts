import * as assert from 'assert';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('public key start with BEGIN RSA PUBLIC KEY')
class PublicKeySuite {

  @Test('should work')
  async test() {
    const certPub = await TestFixtures.read('/rsa-public-key.pem');
    const certPriv = await TestFixtures.read('/rsa-private.pem');

    const token = await JWTUtil.create({ foo: 'bar' }, { key: certPriv, alg: 'RS256' });

    assert(await JWTUtil.verify(token, { key: certPub, alg: 'RS256' }));
  }
}
