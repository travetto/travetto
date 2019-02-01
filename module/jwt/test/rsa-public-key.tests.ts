import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import * as jwt from '..';

@Suite('public key start with BEGIN RSA PUBLIC KEY')
class PublicKeySuite {

  @Test('should work')
  async test() {
    const cert_pub = await ResourceManager.read('/rsa-public-key.pem');
    const cert_priv = await ResourceManager.read('/rsa-private.pem');

    const token = await jwt.sign({ foo: 'bar' }, { key: cert_priv, alg: 'RS256' });

    assert(await jwt.verify(token, { key: cert_pub, alg: 'RS256' }));
  }
}
