import * as assert from 'assert';
import * as fs from 'fs';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('issue 70 - public key start with BEING PUBLIC KEY')
class Issue70 {

  @Test('should work')
  async test() {
    const cert_pub = fs.readFileSync(`${__dirname}/rsa-public.pem`);
    const cert_priv = fs.readFileSync(`${__dirname}/rsa-private.pem`);

    const token = await jwt.sign({ foo: 'bar' }, { key: cert_priv, alg: 'RS256' });

    await jwt.verify(token, { key: cert_pub, alg: 'RS256' });
  }

}