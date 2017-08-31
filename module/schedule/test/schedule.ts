import { timeout } from '@encore/test';
import { Schedule } from '../src';
import { expect } from 'chai';

describe('Scheduled task tests', () => {
  it('Should fire immediately after startup', timeout(6000, async () => {
    let val = 0;
    Schedule.schedule('* * * * * *', {
      onTick: () => {
        val += 1;
      }
    });
    Schedule.launch();
    await new Promise(resolve => setTimeout(resolve, 5500));
    expect(val).to.equal(5);
  }));
});

