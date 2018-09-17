import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Scheduler } from '../';

@Suite()
class Scheduling {

  @Test()
  async timing() {
    let val = 0;

    Scheduler.perSecond(() => {
      val += 1;
    });

    await new Promise(resolve => setTimeout(resolve, 2010));

    assert(val >= 1);

    await new Promise(resolve => setTimeout(resolve, 2010));

    assert(val >= 3);
  }
}