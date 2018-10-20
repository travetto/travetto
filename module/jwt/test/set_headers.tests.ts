import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import * as jwt from '..';

@Suite('set header')
class HeaderSuite {

  @Test('should add the header')
  async testHeaderAdd() {
    const token = await jwt.sign({ foo: 123 }, { key: '123', header: { foo: 'bar' } });
    const decoded = await jwt.decodeComplete(token);
    assert(decoded.header.foo === 'bar');
  }

  @Test('should allow overriding header')
  async testHeaderOverride() {
    const token = await jwt.sign({ foo: 123 }, { key: '123', alg: 'HS512' });
    const decoded = jwt.decodeComplete(token);
    assert(decoded.header.alg === 'HS512');
  }
}
