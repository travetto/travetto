import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Resources } from '@travetto/base';

import { JWTUtil } from '..';

@Suite('public key start with BEGIN RSA PUBLIC KEY')
class PublicKeySuite {

  @Test('should work')
  async test() {
    const certPub = await Resources.read('test:/rsa-public-key.pem');
    const certPriv = await Resources.read('test:/rsa-private.pem');

    const token = await JWTUtil.create({ foo: 'bar' }, { key: certPriv, alg: 'RS256' });

    assert(await JWTUtil.verify(token, { key: certPub, alg: 'RS256' }));
  }
}
