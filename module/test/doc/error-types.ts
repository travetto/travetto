import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  @Test()
  async errorTypes() {
    assert.throws(() => {
      throw new Error('Big Error');
    }, 'Big Error');

    assert.throws(() => {
      throw new Error('Big Error');
    }, /B.*Error/);

    await assert.rejects(() => {
      throw new Error('Big Error');
    }, Error);

    await assert.rejects(() => {
      throw new Error('Big Error');
    }, (error: Error) =>
      error.message.startsWith('Big') && error.message.length > 4
    );
  }
}