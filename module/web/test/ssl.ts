import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { WebSslUtil } from '../src/util/ssl.ts';

@Suite()
export class SSLTest {
  @Test()
  async verify() {
    const result = await WebSslUtil.generateKeyPair();

    assert(!!result.cert);
    assert(!!result.key);
    assert(/^-+BEGIN CERTIFICATE-+(\n|\r)+/s.test(result.cert));
    assert(/^-+BEGIN( RSA)? PRIVATE KEY-+(\n|\r)+/s.test(result.key));
  }
}