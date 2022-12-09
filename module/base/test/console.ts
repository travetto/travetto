import assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { ConsoleManager, log } from '../src/console';

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: { args: unknown[], level: string, ctx: Record<string, unknown> }[] = [];
    ConsoleManager.set({
      onLog: (level, ctx, args) => logs.push({ level, ctx, args })
    });
    log('info', { source: '', line: 0, module: '@travetto/base', modulePath: 'test/console.js' }, 'a', 'b', 'c');
    assert(logs.length === 1);
    assert.deepStrictEqual(logs[0].args, ['a', 'b', 'c']);
  }
}