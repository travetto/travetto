import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Terminal, WAIT_TOKEN } from '../src/terminal.ts';
import { TerminalUtil } from '../src/util.ts';

@Suite()
class TerminalProgressTests {
  @Test()
  async verifyProgressBarUpdater() {
    const terminal = new Terminal(process.stdout, { width: 60, height: 24 });
    const updater = TerminalUtil.progressBarUpdater(terminal, { withWaiting: true });

    const first = updater({ completed: 5, total: 10, value: 'Task %completed/%total (%progress%)' });
    const second = updater({ completed: 5, total: 10, value: 'Task %completed/%total (%progress%)' });

    assert(first.startsWith(`${WAIT_TOKEN} `));
    assert(first.includes('Task 5/10 (50%)'));
    assert(second.includes('Task 5/10 (50%)'));
  }
}
