import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { SystemUtil } from '../src/system-util';

class Test2 { }

@Suite()
class SystemUtilTests {

  @Test()
  orderDependents() {
    const items: any = [
      {
        key: 'first'
      },
      {
        after: ['first', 'fourth'],
        key: 'fifth'
      },
      {
        after: 'first',
        key: 'third'
      },
      {
        after: ['first'],
        key: 'second'
      },
      {
        after: new Set(['first', 'second']),
        key: 'fourth'
      },
      {
        after: new Set(['fifth']),
        key: 'sixth'
      }
    ];

    const order = SystemUtil.computeOrdering(items);
    const ordered = order.map(x => x.key);
    assert(ordered === ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    items.unshift({ key: 'tenth', before: 'second' });

    const order2 = SystemUtil.computeOrdering(items);
    const ordered2 = order2.map(x => x.key);
    assert(ordered2 === ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }
}
