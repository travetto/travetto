import { Scheduler } from '../src';
import { Suite, Test } from '@travetto/test';
import { assert } from 'console';

@Suite()
class Scheduling {

  @Test()
  async timing() {
    let val = 0;
    Scheduler.perSecond(() => {
      val += 1;
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    assert(val === 1);

    await new Promise(resolve => setTimeout(resolve, 1600));

    assert(val === 3);
  }

}
