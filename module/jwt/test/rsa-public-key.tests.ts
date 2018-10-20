import * as jws from 'jws';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

const readFile = util.promisify(fs.readFile);

@Suite('public key start with BEGIN RSA PUBLIC KEY')
class PublicKeySuite {

  @Test('should work')
  async test() {
    const cert_pub = readFile(path.resolve(__dirname, 'rsa-public-key.pem'));
    const cert_priv = readFile(path.resolve(__dirname, 'rsa-private.pem'));

    const token = await jwt.sign({ foo: 'bar' }, { key: cert_priv, alg: 'RS256' });

    assert(await jwt.verify(token, { key: cert_pub, alg: 'RS256' }));
  }
}
