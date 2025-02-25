import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Util } from '@travetto/runtime';

import { PassportUtil } from '../src/util.ts';

@Suite()
class PassportUtilSuite {
  @Test()
  async verifyReadWrite() {
    assert(PassportUtil.readState(PassportUtil.writeState({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyRead() {
    assert(PassportUtil.readState(Util.encodeSafeJSON({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyWrite() {
    assert(PassportUtil.writeState({ name: 'bob' }) === Util.encodeSafeJSON({ name: 'bob' }));
  }

  @Test()
  async verifyUpdate() {
    const added = PassportUtil.addToState({ name: 'george', age: 20 }, Util.encodeSafeJSON({ name: 'bob' }));
    assert(PassportUtil.readState(added)?.name === 'george');
    assert(PassportUtil.readState(added)?.age === 20);
  }

  @Test()
  async verifyUpdateKey() {
    const added = PassportUtil.addToState({ age: 20 }, Util.encodeSafeJSON({ name: 'bob' }), 'det');
    assert(PassportUtil.readState(added)?.name === 'bob');
    assert(PassportUtil.readState<{ det: { age: number } }>(added)?.det.age === 20);
  }
}