import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

import { AsyncQueue } from '../src/queue.ts';

@Suite()
export class WorkSetTest {

  @Test()
  async eventSource() {
    const items = [1, 2, 3];
    const comp = items.slice(0);
    const itr = new AsyncQueue();

    for (let i = 0; i < items.length; i++) {
      setTimeout(() => itr.add(items[i]), (i + 1) * 1000);
    }
    while (comp.length) {
      assert((await itr.next()).value === comp.shift()!);
    }
    itr.close();
  }
}