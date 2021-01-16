import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ConsoleManager } from '../src/console';

declare const ᚕlg: (level: string, ctx: Record<string, unknown>, ...args: unknown[]) => void;

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    const logs: { args: unknown[], level: string, ctx: Record<string, unknown> }[] = [];
    ConsoleManager.set({
      onLog: (level, ctx, args) => logs.push({ level, ctx, args })
    });
    ᚕlg('info', {}, 'a', 'b', 'c');
    assert(logs.length === 1);
    assert(logs[0].args === ['a', 'b', 'c']);
  }
}