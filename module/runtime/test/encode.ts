import crypto from 'node:crypto';
import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { EncodeUtil } from '@travetto/runtime';

@Suite()
export class EncodeUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifySimpleHash() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(EncodeUtil.hash('roger', { length: 64 }) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(EncodeUtil.hash('', { length: 20 }) === unKey.substring(0, 20));

    assert(EncodeUtil.hash('', { length: 20 }) !== key.substring(0, 20));
  }
}