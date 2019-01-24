import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import * as jwt from '..';

@Suite('issue 70 - public key start with BEING PUBLIC KEY')
class Issue70 {

  @Test('should work')
  async test() {
    const cert_pub = await ResourceManager.read('rsa-public.pem');
    const cert_priv = await ResourceManager.read('rsa-private.pem');

    const token = await jwt.sign({ foo: 'bar' }, { key: cert_priv, alg: 'RS256' });

    await jwt.verify(token, { key: cert_pub, alg: 'RS256' });
  }

}