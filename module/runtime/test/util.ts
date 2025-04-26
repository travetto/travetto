import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { Util, AsyncQueue, AppError } from '@travetto/runtime';

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

  @Test()
  async verifySerialize() {
    const payload = {
      err: new AppError('Uh-oh'),
      count: 2000n
    };

    const plain = JSON.parse(Util.serializeToJSON(payload));
    assert('err' in plain);
    assert(typeof plain.err === 'object');
    assert('$' in plain.err);
    assert('stack' in plain.err);
    assert(typeof plain.err.stack === 'string');

    console.error(plain);

    const complex: typeof payload = Util.deserializeFromJson(JSON.stringify(plain));

    assert(complex.err instanceof AppError);
    assert(complex.err.stack === payload.err.stack);
    assert(typeof complex.count === 'bigint');
  }
}