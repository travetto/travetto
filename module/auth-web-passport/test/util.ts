import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { CodecUtil } from '@travetto/runtime';
import { PassportUtil } from '@travetto/auth-web-passport';

@Suite()
class PassportUtilSuite {
  @Test()
  async verifyReadWrite() {
    assert(PassportUtil.readState(PassportUtil.writeState({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyRead() {
    assert(PassportUtil.readState(CodecUtil.toBase64JSON({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyWrite() {
    assert(PassportUtil.writeState({ name: 'bob' }) === CodecUtil.toBase64JSON({ name: 'bob' }));
  }

  @Test()
  async verifyUpdate() {
    const added = PassportUtil.addToState({ name: 'george', age: 20 }, CodecUtil.toBase64JSON({ name: 'bob' }));
    assert(PassportUtil.readState(added)?.name === 'george');
    assert(PassportUtil.readState(added)?.age === 20);
  }

  @Test()
  async verifyUpdateKey() {
    const added = PassportUtil.addToState({ age: 20 }, CodecUtil.toBase64JSON({ name: 'bob' }), 'det');
    assert(PassportUtil.readState(added)?.name === 'bob');
    assert(PassportUtil.readState<{ det: { age: number } }>(added)?.det.age === 20);
  }
}