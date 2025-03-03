import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { WebSslUtil } from '../src/util/ssl';

@Suite()
export class SSLTest {
  @Test()
  async verify() {
    const res = await WebSslUtil.generateKeyPair();

    assert(!!res.cert);
    assert(!!res.key);
    assert(/^-+BEGIN CERTIFICATE-+(\n|\r)+/s.test(res.cert));
    assert(/^-+BEGIN( RSA)? PRIVATE KEY-+(\n|\r)+/s.test(res.key));
  }
}