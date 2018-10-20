import * as assert from 'assert';
import { Suite, Test, ShouldThrow } from '@travetto/test';

import * as jwt from '..';

@Suite('decoding')
class DecodingTest {

  @Test('should not crash when decoding a null token')
  async testDecode() {
    await assert.throws(() => jwt.decode('null'), 'malformed token');
    await assert.throws(() => jwt.decode('null.null'), 'malformed token');
    await assert.throws(() => jwt.decode('null.null.null.null'), 'malformed token');
  }

  @Test('should not crash when decoding a null.null.null token')
  @ShouldThrow('invalid token')
  async testDecodeInvalid() {
    const decoded = await jwt.decode('null.null.null');
  }
}