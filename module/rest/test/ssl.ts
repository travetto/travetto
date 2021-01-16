import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { RestServerUtil } from '../src/server/util';

@Suite()
export class SSLTest {
  @Test()
  async verify() {
    const res = await RestServerUtil.generateSslKeyPair();

    assert(!!res.cert);
    assert(!!res.key);
    assert(/^-+BEGIN CERTIFICATE-+(\n|\r)+/s.test(res.cert));
    assert(/^-+BEGIN( RSA)? PRIVATE KEY-+(\n|\r)+/s.test(res.key));
  }
}