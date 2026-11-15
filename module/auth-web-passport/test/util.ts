import assert from 'node:assert';

import { PassportUtil } from '@travetto/auth-web-passport';
import { JSONUtil } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

@Suite()
class PassportUtilSuite {
  @Test()
  async verifyReadWrite() {
    assert(PassportUtil.decodeState(PassportUtil.encodeState({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyRead() {
    assert(PassportUtil.decodeState(JSONUtil.toBase64({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyWrite() {
    assert(PassportUtil.encodeState({ name: 'bob' }) === JSONUtil.toBase64({ name: 'bob' }));
  }

  @Test()
  async verifyUpdate() {
    const added = PassportUtil.addToState({ name: 'george', age: 20 }, JSONUtil.toBase64({ name: 'bob' }));
    assert(PassportUtil.decodeState(added)?.name === 'george');
    assert(PassportUtil.decodeState(added)?.age === 20);
  }

  @Test()
  async verifyUpdateKey() {
    const added = PassportUtil.addToState({ age: 20 }, JSONUtil.toBase64({ name: 'bob' }), 'det');
    assert(PassportUtil.decodeState(added)?.name === 'bob');
    assert(PassportUtil.decodeState<{ det: { age: number } }>(added)?.det.age === 20);
  }
}
