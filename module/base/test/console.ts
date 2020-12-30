import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ConsoleManager } from '../src/console';

declare const ᚕlg: any;

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: any[] = [];
    ConsoleManager.set({
      onLog: (level, ctx, args) => logs.push({ level, ctx, args })
    });
    (ᚕlg as any)('info', {}, 'a', 'b', 'c');
    assert(logs.length === 1);
    assert(logs[0].args === ['a', 'b', 'c']);
  }
}