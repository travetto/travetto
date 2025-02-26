import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

import { ConsoleEvent, ConsoleManager } from '../src/console.ts';

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: ConsoleEvent[] = [];
    const og = ConsoleManager.get();
    ConsoleManager.set({
      log: (ev) => logs.push(ev)
    });
    console.log('a', 'b', 'c');
    assert(logs.length === 1);
    assert.deepStrictEqual(logs[0].args, ['a', 'b', 'c']);
    ConsoleManager.set(og);
  }
}