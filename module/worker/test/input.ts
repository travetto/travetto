import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { IterableInputSource } from '../src/input/iterable';
import { DynamicAsyncIterator } from '../src/input/async-iterator';

@Suite()
export class InputSourceTest {
  @Test()
  async iterable() {
    const items = [1, 2, 3];
    const comp = items.slice(0);
    const src = new IterableInputSource(items);
    while (await src.hasNext()) {
      assert((await src.next()) === comp.shift()!);
    }

    assert(!(await src.hasNext()));
  }

  @Test()
  async iterator() {
    const items = [1, 2, 3];
    const comp = items.slice(0);
    const src = new IterableInputSource(items[Symbol.iterator]());
    while (await src.hasNext()) {
      assert((await src.next()) === comp.shift()!);
    }

    assert(!(await src.hasNext()));
  }

  @Test()
  async generator() {
    const items = [1, 2, 3];
    const gen = function* () { yield* items; };
    const comp = items.slice(0);
    const src = new IterableInputSource(gen);
    while (await src.hasNext()) {
      assert((await src.next()) === comp.shift()!);
    }

    assert(!(await src.hasNext()));
  }

  @Test()
  async asyncGenerator() {
    const items = [1, 2, 3];
    const gen = async function* () {
      for await (const el of items) {
        yield el;
      }
    };
    const comp = items.slice(0);
    const src = new IterableInputSource(gen);
    while (await src.hasNext()) {
      assert((await src.next()) === comp.shift()!);
    }

    assert(!(await src.hasNext()));
  }

  @Test()
  async eventSource() {
    const items = [1, 2, 3];
    const comp = items.slice(0);
    const itr = new DynamicAsyncIterator();
    const src = new IterableInputSource(itr);

    for (let i = 0; i < items.length; i++) {
      setTimeout(() => itr.add(items[i]), (i + 1) * 1000);
    }
    while (comp.length) {
      assert((await src.next()) === comp.shift()!);
    }
    itr.close();
  }
}