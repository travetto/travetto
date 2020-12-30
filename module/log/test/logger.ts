import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';

import { Logger } from '../src/service';
import { LogEvent } from '../src/types';
import { JsonFormatter } from '../src/formatter/json';

@Suite('Suite')
class LoggerTest {

  @BeforeAll()
  async init() {
    Logger.removeAll();
  }

  @Test('Should Log')
  async shouldLog() {
    const events: LogEvent[] = [];
    Logger.listen('test', e => events.push(e));
    (function (ᚕlg) {
      console.log('Hello', { args: [1, 2, 3] });
    })((level: string, ctx: any, message: string, payload: any) => Logger.onLog(level as 'debug', ctx, [message, payload]));
    assert(events.length === 1);
    assert(events[0].message === 'Hello');
    assert.deepStrictEqual(events[0].context, { args: [1, 2, 3] });
  }

  @Test('Formatter')
  async shouldFormat() {
    const formatter = new JsonFormatter({});
    const now = Date.now();
    assert(formatter.format({ level: 'error', timestamp: now } as any) === `{"level":"error","timestamp":${now}}`);
  }
}
