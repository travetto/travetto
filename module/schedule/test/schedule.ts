import { timeout } from '@encore/test';
import { Schedule } from '../src';
import { expect } from 'chai';
import { Registry } from '@encore/di';

describe('Scheduled task tests', () => {
  it('Should fire immediately after startup', timeout(6000, async () => {
    let sc = await Registry.getInstance(Schedule);
    let val = 0;
    sc.perSecond(() => {
      val += 1;
    });
    await new Promise(resolve => setTimeout(resolve, 5500));
    expect(val).to.equal(5);
  }));
});

