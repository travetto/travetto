import * as assert from 'assert';

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
    }, (err: Error) =>
      err.message.startsWith('Big') && err.message.length > 4 ? undefined : err
    );
  }
}