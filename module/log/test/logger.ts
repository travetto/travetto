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
    (function (ᚕlog) {
      console.log('Hello', { args: [1, 2, 3] });
    })((level: string, ctx: LogEvent, message: string, context: Record<string, unknown>) => Logger.onLog(level as 'debug', ctx, [message, context]));
    assert(events.length === 1);
    assert(events[0].message === 'Hello');
    assert.deepStrictEqual(events[0].context, { args: [1, 2, 3] });
  }

  @Test('Formatter')
  async shouldFormat() {
    const formatter = new JsonFormatter({});
    const now = new Date().toISOString();
    assert(formatter.format({ level: 'error', timestamp: now } as LogEvent) === `{"level":"error","timestamp":"${now}"}`);
  }
}
