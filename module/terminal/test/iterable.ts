import timers from 'node:timers/promises';
import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { ManualAsyncIterator } from '@travetto/worker';

import { IterableUtil } from '../src/iterable';

@Suite()
export class IterableUtilSuite {

  @Test()
  async verifyMap() {
    const lines = new ManualAsyncIterator(['aaa', 'bbb']);

    const indicator = IterableUtil.map(
      lines,
      IterableUtil.DELAY({ initialDelay: 0 }),
      (text, i) => `${text} = ${i}`
    );
    const values: string[] = [];
    let j = 0;
    for await (const el of indicator) {
      values.push(el);
      if ((j += 1) === 2) {
        break;
      }
    }

    assert(values[0] === 'aaa = 0');
    assert(values[1] === 'bbb = 1');
  }

  @Test()
  async verifyBasicCycle() {
    const { stream } = IterableUtil.cycle(['1', '2', '3']);
    const values: string[] = [];
    let j = 0;
    for await (const el of stream) {
      values.push(el);
      if (++j === 4) { break; }
    }
    assert.deepStrictEqual(values, ['1', '2', '3', '1']);
  }

  @Test()
  async verifyCycle() {
    const { stream } = IterableUtil.cycle(['1', '2', '3']);
    const message = 'bob';
    const indicator = IterableUtil.map(
      stream,
      (ch, i) => `${message} = ${ch}`
    );

    const values: string[] = [];
    let j = 0;
    for await (const el of indicator) {
      values.push(el);
      if ((j += 1) === 4) {
        break;
      }
    }

    assert(values[0] === 'bob = 1');
    assert(values[1] === 'bob = 2');
    assert(values[2] === 'bob = 3');
    assert(values[3] === 'bob = 1');
  }

  @Test()
  async verifySimpleQueue() {
    const q = IterableUtil.simpleQueue();
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    let total = 0;
    const written: number[] = [];
    await Promise.all(vals.map((_, i) =>
      q.add(async () => {
        const temp = total;
        await timers.setTimeout(50);
        total = temp + 1;
        written.push(total);
      })
    ));
    assert.deepStrictEqual(written, vals);
  }
}