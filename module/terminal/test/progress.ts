import assert from 'node:assert';
import type tty from 'node:tty';

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

  @Test()
  async verifyStreamListAllocatesOnceAndTruncates() {
    const written: string[] = [];
    const output = {
      isTTY: true,
      columns: 20,
      rows: 24,
      write: (chunk: string | Uint8Array): boolean => {
        written.push(chunk.toString());
        return true;
      }
    } as unknown as tty.WriteStream;

    process.env.TRV_QUIET = 'false';

    const terminal = new Terminal(output, { width: 20, height: 24 });
    async function* events() {
      yield { idx: 0, text: 'row-0' };
      yield { idx: 1, text: 'row-1-initial' };
      yield { idx: 1, text: 'row-1-updated-with-very-long-text' };
    }

    await terminal.streamList(events());

    const combined = written.join('');
    // Only 1 newline to allocate row 1 + 1 newline from finally cleanup
    assert.strictEqual(combined.match(/\n/g)?.length, 2);
    assert(combined.includes('row-1-updated-with-…'));
    assert(!combined.includes('row-1-updated-with-very-long-text'));
  }
}
