import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { LogUtil } from '../src/util';

@Suite('Util Suite')
class UtilTest {

  @Test()
  async testFilters() {

    let filter = LogUtil.buildFilter('*');
    assert(filter === LogUtil.truth);

    filter = LogUtil.buildFilter('');
    assert(filter === LogUtil.falsehood);

    filter = LogUtil.buildFilter('@app:*');
    assert(filter('@app:test'));

    filter = LogUtil.buildFilter('@app:test:*');
    assert(!filter('@app:test'));
    assert(filter('@app:test:2'));

    filter = LogUtil.buildFilter('@app:test,-@app:test/2');
    assert(filter('@app:test/@'));
    assert(!filter('@app:test/2'));
  }
}
