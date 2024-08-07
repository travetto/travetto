import crypto from 'node:crypto';
import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { WorkQueue } from '@travetto/worker';

import { Util } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));

    assert(Util.uuid().length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }

  @Test()
  staticUuidVerify() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(Util.hash('roger', 64) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(Util.hash('', 20) === unKey.substring(0, 20));

    assert(Util.hash('', 20) !== key.substring(0, 20));
  }

  @Test()
  async verifyMap() {
    const lines = new WorkQueue(['aaa', 'bbb']);

    const values: string[] = [];
    let j = 0;
    for await (const el of Util.mapAsyncItr(lines, (text, i) => `${text} = ${i}`)) {
      values.push(el);
      if ((j += 1) === 2) {
        lines.close();
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }
}