import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { Service } from '../src/tree';
import { Service2 } from '../src/tree2';
import { Service3 } from '../src/tree3';

@Suite()
export class TransformSuite {
  @Test()
  async verify() {
    // @ts-expect-error
    const res = new Service()['GETTREE']();
    assert(res?.value === 5);

    // @ts-expect-error
    const res2 = await new Service2()['GETTREE']();
    assert(res2?.value === 5);

    // @ts-expect-error
    const res3 = await new Service3()['GETTREE']();
    assert(res3?.left.value === 'bob');
  }
}