import assert from 'node:assert';

import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { castTo, ConsoleListener, ConsoleManager } from '@travetto/runtime';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { LogService } from '../src/service.ts';
import { LogDecorator, LogEvent, Logger } from '../src/types.ts';
import { JsonLogFormatter } from '../src/formatter/json.ts';
import { LogFormatUtil } from '../src/formatter/util.ts';

@Injectable()
class CustomLogger implements Logger {

  values: LogEvent[] = [];

  log(ev: LogEvent): void {
    this.values.push(ev);
  }

  reset(): void {
    this.values = [];
  }
}

@Injectable()
class Decorator implements LogDecorator {
  decorate(ev: LogEvent): LogEvent {
    ev.args.push({ extra: { secret: true } });
    return ev;
  }
}

@Suite('Suite')
class LoggerTest {

  mgr: ConsoleListener;

  @BeforeAll()
  init() {
    return RootRegistry.init();
  }

  @BeforeEach()
  async reset() {
    this.mgr = ConsoleManager.get();
    (await DependencyRegistry.getInstance(CustomLogger)).reset();
  }

  restConsole(): void {
    ConsoleManager.set(this.mgr);
  }

  @Test('Should Log')
  async shouldLog() {
    const svc = await DependencyRegistry.getInstance(LogService);
    ConsoleManager.set(svc);

    console.log('Hello', { args: [1, 2, 3] });

    this.restConsole();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert.deepStrictEqual(context?.args, [1, 2, 3]);
  }

  @Test('Formatter')
  async shouldFormat() {
    const formatter = new JsonLogFormatter({});
    const now = new Date();
    assert(formatter.format(castTo({ level: 'error', timestamp: now })) === `{"level":"error","timestamp":"${now.toISOString()}"}`);
  }

  @Test('Decorator')
  async shouldDecorate() {
    const svc = await DependencyRegistry.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { otherSecret: true });
    this.restConsole();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert.deepStrictEqual(context?.extra, { secret: true });
    assert.deepStrictEqual(context?.otherSecret, true);
  }

  @Test('Decorator Override')
  async shouldDecorateOverride() {
    const svc = await DependencyRegistry.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { secret: true });
    this.restConsole();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert.deepStrictEqual(context?.secret, true);
  }

  @Test('Verify context handling')
  async verifyContext() {
    const svc = await DependencyRegistry.getInstance(LogService);
    const logger = await DependencyRegistry.getInstance(CustomLogger);

    ConsoleManager.set(svc);
    console.log('Hello', 'Roger', { secret: true });
    console.error(svc);
    console.error(logger);
    this.restConsole();

    assert(logger.values.length === 3);
    assert(logger.values[0].message === 'Hello');
    assert(logger.values[0].args[0] === 'Roger');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert(context?.secret === true);
    const context2 = LogFormatUtil.getContext(logger.values[1]);
    assert.deepStrictEqual(Object.keys(context2 ?? {}), ['extra',]);
    assert(logger.values[1].message === undefined);
    const context3 = LogFormatUtil.getContext(logger.values[2]);
    assert.deepStrictEqual(Object.keys(context3 ?? {}), ['extra']);
    assert.deepStrictEqual(context3?.extra, { secret: true });
  }
}
