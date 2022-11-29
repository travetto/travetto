import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { LogUtil } from '../src/util';

@Suite('Util Suite')
class UtilTest {

  @Test()
  async testFilters() {

    const filter = LogUtil.buildFilter('*');
    assert(filter === undefined);

    let filter2 = LogUtil.buildFilter('@');
    assert(filter2);
    assert(filter2('@trv:log/src/'));
    assert(!filter2('@trv:log2/src/sub'));

    filter2 = LogUtil.buildFilter('*,-@');
    assert(filter2);
    assert(!filter2('@trv:log/src/sub'));
    assert(filter2('@trv:log2/src/sub/2'));

    filter2 = LogUtil.buildFilter('@travetto/boot');
    assert(filter2);
    assert(filter2('@trv:boot/src/sub'));
    assert(!filter2('@trv:log/src/sub/2'));


    filter2 = LogUtil.buildFilter('@travetto/boot,@trv:log');
    assert(filter2);
    assert(filter2('@trv:boot/src/sub'));
    assert(filter2('@trv:log/src/sub/2'));
    assert(!filter2('@trv:manifest/src/sub/2'));
  }
}
