import * as assert from 'assert';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('public key start with BEGIN RSA PUBLIC KEY')
class PublicKeySuite {

  fixture = new TestFixtures();

  @Test('should work')
  async test() {
    const certPub = await this.fixture.read('/rsa-public-key.pem');
    const certPriv = await this.fixture.read('/rsa-private.pem');

    const token = await JWTUtil.create({ foo: 'bar' }, { key: certPriv, alg: 'RS256' });

    assert(await JWTUtil.verify(token, { key: certPub, alg: 'RS256' }));
  }
}
