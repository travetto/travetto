import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { PassportUtil } from '../__index__';

@Suite()
class PassportUtilSuite {
  @Test()
  async verifyReadWrite() {
    assert(PassportUtil.readState(PassportUtil.writeState({ name: 'bob' }))?.name === 'bob');
  }

  @Test()
  async verifyRead() {
    assert(PassportUtil.readState(Buffer.from(JSON.stringify({ name: 'bob' })).toString('base64'))?.name === 'bob');
  }

  @Test()
  async verifyWrite() {
    assert(PassportUtil.writeState({ name: 'bob' }) === Buffer.from(JSON.stringify({ name: 'bob' })).toString('base64'));
  }

  @Test()
  async verifyUpdate() {
    const added = PassportUtil.addToState({ name: 'george', age: 20 }, Buffer.from(JSON.stringify({ name: 'bob' })).toString('base64'));
    assert(PassportUtil.readState(added)?.name === 'george');
    assert(PassportUtil.readState(added)?.age === 20);
  }

  @Test()
  async verifyUpdateKey() {
    const added = PassportUtil.addToState({ age: 20 }, Buffer.from(JSON.stringify({ name: 'bob' })).toString('base64'), 'deet');
    assert(PassportUtil.readState(added)?.name === 'bob');
    assert(PassportUtil.readState<{ deet: { age: number } }>(added)?.deet.age === 20);
  }
}