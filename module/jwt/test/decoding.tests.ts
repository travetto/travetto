import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import { JWTUtil } from '..';

@Suite('decoding')
class DecodingTest {

  @Test('should not crash when decoding a null token')
  async testDecode() {
    await assert.throws(() => JWTUtil.read('null'), 'malformed token');
    await assert.throws(() => JWTUtil.read('null.null'), 'malformed token');
    await assert.throws(() => JWTUtil.read('null.null.null.null'), 'malformed token');
  }

  @Test('should not crash when decoding a null.null.null token')
  @ShouldThrow('invalid token')
  async testDecodeInvalid() {
    JWTUtil.read('null.null.null');
  }
}