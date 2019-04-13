import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { SSLUtil } from '../src/util/ssl';

@Suite()
export class SSLTest {
  @Test()
  async verify() {
    const res = await SSLUtil.generateKeyPair();

    assert(!!res.cert);
    assert(!!res.key);
    assert(/^-+BEGIN CERTIFICATE-+\n/s.test(res.cert));
    assert(/^-+BEGIN PRIVATE KEY-+\n/s.test(res.key));
  }
}