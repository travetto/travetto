import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { ConsoleManager } from '../src/console';
import { trv } from '../support/init.helper';

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: { args: unknown[], level: string, ctx: Record<string, unknown> }[] = [];
    ConsoleManager.set({
      onLog: (level, ctx, args) => logs.push({ level, ctx, args })
    });
    trv.log('info', { file: '', line: 0, category: '' }, 'a', 'b', 'c');
    assert(logs.length === 1);
    assert.deepStrictEqual(logs[0].args, ['a', 'b', 'c']);
  }
}