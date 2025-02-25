import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';

import { AsyncQueue } from '../src/queue';
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
  async verifyMap() {
    const lines = new AsyncQueue(['aaa', 'bbb']);

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