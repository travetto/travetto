import assert from 'assert';

import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { ConsoleManager } from '@travetto/base';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { LogService } from '../src/service';
import { LogDecorator, LogEvent, Logger } from '../src/types';
import { JsonLogFormatter } from '../src/formatter/json';

@Injectable()
class CustomLogger implements Logger {

  values: LogEvent[] = [];

  onLog(ev: LogEvent): void {
    this.values.push(ev);
  }

  reset(): void {
    this.values = [];
  }
}

@Injectable()
class Decorator implements LogDecorator {
  decorate(ev: LogEvent): LogEvent {
    (ev.context ??= {}).secret ??= false;
    return ev;
  }
}

@Suite('Suite')
class LoggerTest {

  @BeforeAll()
  init() {
    return RootRegistry.init();
  }

  @BeforeEach()
  async reset() {
    (await DependencyRegistry.getInstance(CustomLogger)).reset();
  }

  @Test('Should Log')
  async shouldLog() {
    const svc = await DependencyRegistry.getInstance(LogService);
    ConsoleManager.set(svc);

    console.log('Hello', { args: [1, 2, 3] });

    ConsoleManager.clear();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    assert.deepStrictEqual(logger.values[0].context?.args, [1, 2, 3]);
  }

  @Test('Formatter')
  async shouldFormat() {
    const formatter = new JsonLogFormatter({});
    const now = new Date();
    assert(formatter.format({ level: 'error', timestamp: now } as LogEvent) === `{"level":"error","timestamp":"${now.toISOString()}"}`);
  }

  @Test('Decorator')
  async shouldDecorate() {
    const svc = await DependencyRegistry.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { otherSecret: true });
    ConsoleManager.clear();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    assert.deepStrictEqual(logger.values[0].context?.secret, false);
    assert.deepStrictEqual(logger.values[0].context?.otherSecret, true);
  }

  @Test('Decorator Override')
  async shouldDecorateOverride() {
    const svc = await DependencyRegistry.getInstance(LogService);

    ConsoleManager.set(svc);
    console.log('Hello', { secret: true });
    ConsoleManager.clear();

    const logger = await DependencyRegistry.getInstance(CustomLogger);
    assert(logger.values.length === 1);
    assert(logger.values[0].message === 'Hello');
    assert.deepStrictEqual(logger.values[0].context?.secret, true);
  }
}
