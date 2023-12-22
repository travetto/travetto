import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { WorkQueue } from '@travetto/worker';

import { IterableUtil } from '../src/iterable';

@Suite()
export class IterableUtilSuite {

  @Test()
  async verifyMap() {
    const lines = new WorkQueue(['aaa', 'bbb']);

    const indicator = IterableUtil.map(
      lines,
      IterableUtil.DELAY({ initialDelay: 0 }),
      (text, i) => `${text} = ${i}`
    );
    const values: string[] = [];
    let j = 0;
    for await (const el of indicator) {
      values.push(el);
      if ((j += 1) === 2) {
        break;
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }
}