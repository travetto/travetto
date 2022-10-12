import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { SystemUtil } from '../src/internal/system';

@Suite()
export class SystemSuite {

  @Test()
  async testHash() {
    const allHashes = ' '.repeat(1000).split('').map((x, i) => SystemUtil.naiveHash(' '.repeat(i + 2)));
    const hashForSpace = SystemUtil.naiveHash(' ');
    assert(!allHashes.includes(hashForSpace));
  }

  @Test()
  verifyUUID() {
    assert(SystemUtil.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(SystemUtil.uuid(32)));
  }
}