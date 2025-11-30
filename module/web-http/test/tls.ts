import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { WebTlsUtil } from '../src/tls.ts';

@Suite()
export class TlsTest {
  @Test()
  async verify() {
    const result = await WebTlsUtil.generateKeyPair();

    assert(!!result.cert);
    assert(!!result.key);
    assert(/^-+BEGIN CERTIFICATE-+(\n|\r)+/s.test(result.cert));
    assert(/^-+BEGIN( RSA)? PRIVATE KEY-+(\n|\r)+/s.test(result.key));
  }
}