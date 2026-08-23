import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Service } from '../src/tree.ts';
import { Service2 } from '../src/tree2.ts';
import { Service3 } from '../src/tree3.ts';

@Suite()
class TransformSuite {
  @Test()
  async verify() {
    const res = new Service().getTree();
    // @ts-expect-error
    assert(res === 'GET' + 'TREE');

    const res2 = await new Service2().getTree();
    // @ts-expect-error
    assert(res2 === 'GET' + 'TREE');

    const res3 = await new Service3().getTree();
    // @ts-expect-error
    assert(res3 === 'GET' + 'TREE');
  }
}
