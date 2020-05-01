import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { SystemUtil } from '../src/internal/system';

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

  @Test()
  async buildModuleName() {
    const modName = SystemUtil.computeModule(__filename);
    assert(modName === 'test/system-util');

    const modName2 = SystemUtil.computeModule(`${__dirname}/node_modules/@travetto/base/src/system-util.js`);
    assert(modName2 === '@trv:base/system-util');

    const modName3 = SystemUtil.computeModule(`${__dirname}/../test/simple.js`);
    assert(modName3 === 'test/simple');

    const modName4 = SystemUtil.computeModule(`${__dirname}/node_modules/lodash/test`);
    assert(modName4 === '@npm/lodash/test');
  }

}
