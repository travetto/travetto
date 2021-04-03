import * as assert from 'assert';
import { Test, Suite } from '@travetto/test';
import { Orderable, OrderingUtil } from '../src/internal/ordering';

@Suite()
class OrderingUtilTest {

  @Test()
  orderDependents() {
    const items: Orderable<string>[] = [
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
    ];

    const order = OrderingUtil.compute(items);
    const ordered = order.map(x => x.key);
    assert(ordered === ['first', 'third', 'second', 'fourth', 'fifth', 'sixth']);

    items.unshift({ key: 'tenth', before: ['second'] });

    const order2 = OrderingUtil.compute(items);
    const ordered2 = order2.map(x => x.key);
    assert(ordered2 === ['tenth', 'first', 'third', 'second', 'fourth', 'fifth', 'sixth']);
  }
}
