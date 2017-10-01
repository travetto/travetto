import { timeout } from '@travetto/test';
import { Scheduler } from '../src';
import { expect } from 'chai';

describe('Scheduled task tests', () => {
  it('Should fire immediately after startup', timeout(6000, async () => {
    let val = 0;
    Scheduler.perSecond(() => {
      val += 1;
    });
    await new Promise(resolve => setTimeout(resolve, 5500));
    expect(val).to.equal(5);
  }));
});

