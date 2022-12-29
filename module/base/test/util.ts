import assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { Util } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  verifyUUID() {
    assert(Util.uuid(32).length === 32);
    assert(/^[0-9a-f]{32}$/.test(Util.uuid(32)));
  }

  @Test()
  async testHash() {
    const allHashes = ' '.repeat(1000).split('').map((x, i) => Util.naiveHash(' '.repeat(i + 2)));
    const hashForSpace = Util.naiveHash(' ');
    assert(!allHashes.includes(hashForSpace));
  }


  @Test()
  orderDependents() {
    const items = [
      {
        key: 'first'
      },
      {
        after: ['first', 'fourth'],
        key: 'fifth'
      },
      {
        after: ['first'],
        key: 'third'
      },
      {
        after: ['first'],
        key: 'second'
      },
      {
        after: ['first', 'second'],
        key: 'fourth'
      },
      {
        after: ['fifth'],
        key: 'sixth'
      }
    ] as const;

    const order = Util.ordered(items);
    const ordered = order.map(x => x.key);
    assert.deepStrictEqual(ordered, ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    const order2 = Util.ordered([
      { key: 'tenth', before: ['second'] },
      ...items
    ]);
    const ordered2 = order2.map(x => x.key);
    assert.deepStrictEqual(ordered2, ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }
}