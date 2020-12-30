import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { LogUtil } from '../src/util';

@Suite('Util Suite')
class UtilTest {

  @Test()
  async testFilters() {

    let filter = LogUtil.buildFilter('*');
    assert(filter === undefined);

    filter = LogUtil.buildFilter('@app:*');
    assert(filter!('./src/'));

    filter = LogUtil.buildFilter('@app');
    assert(filter!('./src/'));

    filter = LogUtil.buildFilter('@app:sub/*');
    assert(!filter!('./src/sub'));
    assert(filter!('./src/sub/2'));

    filter = LogUtil.buildFilter('@app:sub');
    assert(!filter!('./src/sub'));
    assert(filter!('./src/sub/2'));

    filter = LogUtil.buildFilter('@app:sub,-@app:sub/2');
    assert(filter!('./src/sub/@'));
    assert(!filter!('./src/sub/2'));
  }
}
