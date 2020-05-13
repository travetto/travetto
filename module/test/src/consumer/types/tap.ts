import { YamlUtil } from '@travetto/yaml';
import { ErrorUtil } from '@travetto/base/src/internal/error';

import { AllSuitesResult } from '../../model/suite';
import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { Consumable } from '../registry';

import { TapEnhancer, DUMMY_ENHANCER } from './tap-enhancer';

// TODO: Document
@Consumable('tap')
export class TapEmitter implements Consumer {
  private count = 0;

  constructor(
    private stream: NodeJS.WriteStream = process.stdout,
    private enhancer: TapEnhancer = DUMMY_ENHANCER
  ) { }

  private log(message: string) {
    this.stream.write(`${message}\n`);
  }

  onStart() {
    this.log(this.enhancer.suiteName('TAP version 13'));
  }

  logMeta(obj: any) {
    let body = YamlUtil.serialize(obj);
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${this.enhancer.objectInspect(body)}\n...`);
  }

  onEvent(e: TestEvent) {
    if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      let header = `${this.enhancer.suiteName(test.classId)} - ${this.enhancer.testName(test.methodName)}`;
      if (test.description) {
        header += `: ${this.enhancer.testDescription(test.description)}`;
      }
      this.log(`# ${header}`);

      if (test.assertions.length) {
        let subCount = 0;
        for (const a of test.assertions) {
          const text = a.message ? `${a.text} (${this.enhancer.failure(a.message)})` : a.text;
          let subMessage = [
            this.enhancer.assertNumber(++subCount),
            '-',
            this.enhancer.assertDescription(text),
            `${this.enhancer.assertFile(a.file)}:${this.enhancer.assertLine(a.line)}`
          ].join(' ');

          if (a.error) {
            subMessage = `${this.enhancer.failure('not ok')} ${subMessage}`;
          } else {
            subMessage = `${this.enhancer.success('ok')} ${subMessage}`;
          }
          this.log(`    ${subMessage}`);

          if (a.message && a.message.length > 100) {
            this.logMeta({ message: a.message.replace(/\\n/g, '\n') });
          }
        }
        this.log(`    ${this.enhancer.assertNumber(1)}..${this.enhancer.assertNumber(subCount)}`);
      }

      let status = `${this.enhancer.testNumber(++this.count)} `;
      switch (test.status) {
        case 'skipped': status += ' # SKIP'; break;
        case 'failed': status = `${this.enhancer.failure('not ok')} ${status}`; break;
        default: status = `${this.enhancer.success('ok')} ${status}`;
      }
      status += header;

      this.log(status);

      if (test.status === 'failed') {
        if (test.error && test.error.stack && !test.error.stack.includes('AssertionError')) {
          const err = ErrorUtil.deserializeError(test.error);
          this.logMeta({ error: err.toConsole() });
        }
      }
      if (test.output) {
        for (const key of ['log', 'info', 'error', 'debug', 'warn']) {
          if (test.output[key]) {
            this.logMeta({ [key]: test.output[key] });
          }
        }
      }
    }
  }

  onSummary(summary: AllSuitesResult) {
    this.log(`${this.enhancer.testNumber(1)}..${this.enhancer.testNumber(summary.total)}`);

    if (summary.errors.length) {
      this.log('---\n');
      for (const err of summary.errors) {
        this.log(this.enhancer.failure(err instanceof Error ? err.toConsole!() : `${err}`) as string);
      }
    }

    const allPassed = summary.failed === 0;

    this.log([
      this.enhancer[allPassed ? 'success' : 'failure']('Results'),
      `${this.enhancer.total(summary.passed)}/${this.enhancer.total(summary.total)},`,
      allPassed ? 'failed' : this.enhancer.failure('failed'),
      `${this.enhancer.total(summary.failed)}`,
      'skipped',
      this.enhancer.total(summary.skipped)
    ].join(' '));
  }
}
