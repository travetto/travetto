import { Env } from '@travetto/base';
import { YamlUtil } from '@travetto/yaml';
import { WorkerUtil } from '@travetto/worker';

import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';
import { Consumer } from './types';
import { TapEnhancer, DUMMY_ENHANCER } from './tap-enhancer';

export class TapEmitter implements Consumer {
  private count = 0;

  constructor(private stream: NodeJS.WriteStream = process.stdout, private enhancer: TapEnhancer = DUMMY_ENHANCER) {
    this.log('TAP version 13');
  }

  private log(message: string) {
    this.stream.write(`${message}\n`);
  }

  logMeta(obj: any) {
    let body = YamlUtil.serialize(obj);
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${this.enhancer.objectInspect(body)}\n...`);
  }

  onEvent(e: TestEvent) {
    if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      let header = `${this.enhancer.suiteName(test.className)} - ${this.enhancer.testName(test.methodName)}`;
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
      if (test.status === 'skip') {
        status += ' # SKIP';
      } else if (test.status === 'fail') {
        status = `${this.enhancer.failure('not ok')} ${status}`;
      } else {
        status = `${this.enhancer.success('ok')} ${status}`;
      }
      status += header;

      this.log(status);

      if (test.status === 'fail') {
        if (test.error && test.error.stack && !test.error.stack.includes('AssertionError')) {
          this.logMeta({ error: WorkerUtil.deserializeError(test.error).stack.replace(new RegExp(Env.cwd, 'g'), '.') });
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
        this.log(this.enhancer.failure(err.stack || `${err}`) as string);
      }
    }

    const allSuccess = summary.success === summary.total;

    this.log([
      this.enhancer[allSuccess ? 'success' : 'failure']('Results'),
      `${this.enhancer.total(summary.success)}/${this.enhancer.total(summary.total)},`,
      allSuccess ? 'failed' : this.enhancer.failure('failed'),
      `${this.enhancer.total(summary.fail)}`,
      'skipped',
      this.enhancer.total(summary.skip)
    ].join(' '));
  }
}