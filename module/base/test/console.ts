import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

import { ConsoleEvent } from '../src/types';
import { ConsoleManager } from '../src/console';

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: ConsoleEvent[] = [];
    ConsoleManager.set({
      onLog: (ev) => logs.push(ev)
    });
    console.log('a', 'b', 'c');
    assert(logs.length === 1);
    assert.deepStrictEqual(logs[0].args, ['a', 'b', 'c']);
    ConsoleManager.clear();
  }
}