import { Suite, Test, TestFixtures } from '@travetto/test';

import { JWTUtil } from '../src/util';

@Suite('issue 70 - public key start with BEING PUBLIC KEY')
class Issue70 {

  fixtures = new TestFixtures();

  @Test('should work')
  async test() {
    const certPub = await this.fixtures.read('/rsa-public.pem');
    const certPriv = await this.fixtures.read('/rsa-private.pem');

    const token = await JWTUtil.create({ foo: 'bar' }, { key: certPriv, alg: 'RS256' });

    await JWTUtil.verify(token, { key: certPub, alg: 'RS256' });
  }

}