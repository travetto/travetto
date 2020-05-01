import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ConsoleManager } from '../src/console';

declare const ᚕlg: any;

@Suite()
export class ConsoleManagerTest {

  @Test()
  async testConsole() {
    let logs: any[] = [];
    ConsoleManager.set({
      invoke(payload, args) {
        logs.push({ payload, args });
      }
    });
    (ᚕlg as any)({}, 'a', 'b', 'c');
    assert(logs.length === 1);
    assert(logs[0].args === ['a', 'b', 'c']);

    logs = [];
    ConsoleManager.set({
      enrich: true,
      invoke(payload, line) {
        logs.push(line.join(' '));
      }
    });
    (ConsoleManager as any).timestamp = true;
    (ConsoleManager as any).timeMillis = true;
    (ᚕlg as any)({ level: 'info', file: 'file', category: 'cat', line: 10 }, 'message');
    assert(typeof logs[0] === 'string');
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\s+info\s+\[cat:10]\s+message$/.test(logs[0]));

    (ConsoleManager as any).timeMillis = false;
    (ᚕlg as any)({ level: 'info', file: 'file', category: 'cat', line: 10 }, 'message');
    assert(typeof logs[1] === 'string');
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\s+info\s+\[cat:10]\s+message$/.test(logs[1]));

    (ConsoleManager as any).timestamp = false;
    (ᚕlg as any)({ level: 'info', file: 'file', category: 'cat', line: 10 }, 'message');
    assert(typeof logs[2] === 'string');
    assert(/^info\s+\[cat:10]\s+message$/.test(logs[2]));

  }
}