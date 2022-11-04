import { Suite, Test, TestFixtures } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('issue 70 - public key start with BEING PUBLIC KEY')
class Issue70 {

  @Test('should work')
  async test() {
    const certPub = await TestFixtures.read('/rsa-public.pem');
    const certPriv = await TestFixtures.read('/rsa-private.pem');

    const token = await JWTUtil.create({ foo: 'bar' }, { key: certPriv, alg: 'RS256' });

    await JWTUtil.verify(token, { key: certPub, alg: 'RS256' });
  }

}