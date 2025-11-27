import assert from 'node:assert';

import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { castTo, ConsoleListener, ConsoleManager } from '@travetto/runtime';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { JsonLogFormatter, LogDecorator, LogEvent, LogFormatUtil, Logger, LogService } from '@travetto/log';

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
    return Registry.init();
  }

  @BeforeEach()
  async reset() {
    this.mgr = ConsoleManager.get();
    (await DependencyRegistryIndex.getInstance(CustomLogger)).reset();
  }

  resetConsole(): void {
    ConsoleManager.set(this.mgr);
  }

  @Test('Should Log')
  async shouldLog() {
    const svc = await DependencyRegistryIndex.getInstance(LogService);
    ConsoleManager.set(svc);

    console.log('Hello', { args: [1, 2, 3] });

    this.resetConsole();

    const logger = await DependencyRegistryIndex.getInstance(CustomLogger);
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
    const svc = await DependencyRegistryIndex.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { otherSecret: true });
    this.resetConsole();

    const logger = await DependencyRegistryIndex.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert.deepStrictEqual(context?.extra, { secret: true });
    assert.deepStrictEqual(context?.otherSecret, true);
  }

  @Test('Decorator Override')
  async shouldDecorateOverride() {
    const svc = await DependencyRegistryIndex.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { secret: true });
    this.resetConsole();

    const logger = await DependencyRegistryIndex.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    const context = LogFormatUtil.getContext(logger.values[0]);
    assert.deepStrictEqual(context?.secret, true);
  }

  @Test('Verify context handling')
  async verifyContext() {
    const svc = await DependencyRegistryIndex.getInstance(LogService);
    const logger = await DependencyRegistryIndex.getInstance(CustomLogger);

    ConsoleManager.set(svc);
    console.log('Hello', 'Roger', { secret: true });
    console.error(svc);
    console.error(logger);
    this.resetConsole();

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
