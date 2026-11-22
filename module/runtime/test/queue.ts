import assert from 'node:assert';

import { AsyncQueue } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

@Suite()
export class WorkSetTest {
  @Test()
  async eventSource() {
    const items = [1, 2, 3];
    const comp = items.slice(0);
    const itr = new AsyncQueue();

    for (let i = 0; i < items.length; i += 1) {
      setTimeout(() => itr.add(items[i]), (i + 1) * 1000);
    }
    while (comp.length) {
      assert((await itr.next()).value === comp.shift()!);
    }
    itr.close();
  }

  @Test()
  async closeDrainsAndThrowPropagates() {
    const queue = new AsyncQueue<string>(['one', 'two']);
    queue.close();
    const drained: string[] = [];
    for await (const item of queue) {
      drained.push(item);
    }
    assert.deepStrictEqual(drained, ['one', 'two']);

    const errorQueue = new AsyncQueue<string>();
    errorQueue.add('first');
    errorQueue.add('second');
    assert.strictEqual((await errorQueue.next()).value, 'first');
    await errorQueue.throw(new Error('queue error'));
    await assert.rejects(
      async () => errorQueue.next(),
      (error: unknown) => error instanceof Error && error.message === 'queue error'
    );
  }
}
