import * as yaml from 'js-yaml';
import { TestEvent, SuiteResult, AllSuitesResult, EventEntity, EventPhase } from '../model';
import { Consumer } from './types';
import { deserializeError } from '@travetto/exec';

export class TapEmitter implements Consumer {
  private count = 0;

  constructor(private stream: NodeJS.WriteStream = process.stdout) {
    this.log('TAP version 13');
  }

  private log(message: string) {
    this.stream.write(`${message}\n`)
  }

  logMeta(obj: any) {
    let body = yaml.safeDump(obj, { indent: 2 });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${body}\n...`);
  }

  onEvent(e: TestEvent) {
    if (e.type === 'test' && e.phase === 'after') {
      const { test } = e;
      let header = `${test.className} - ${test.methodName}`;
      if (test.description) {
        header += `: ${test.description}`;
      }
      this.log(`# ${header}`);

      if (test.assertions.length) {
        let subCount = 0;
        const count = test.assertions.length;
        for (const a of test.assertions) {
          const text = a.message ? `${a.text} (${a.message})` : a.text;
          let subMessage = `ok ${++subCount} - ${text} ${a.file}:${a.line}`;
          if (a.error) {
            subMessage = `not ${subMessage}`;
          }
          this.log(`    ${subMessage}`);
        }
        this.log(`    1..${subCount}`);
      }

      let status = `ok ${++this.count} `;
      if (test.status === 'skip') {
        status += ' # SKIP';
      } else if (test.status === 'fail') {
        status = `not ${status}`;
      }
      status += header;

      this.log(status);

      if (test.status === 'fail') {
        if (test.error && test.error.stack && !test.error.stack.includes('AssertionError')) {
          this.logMeta({ error: deserializeError(test.error).stack });
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
    this.log(`1..${summary.total}`);

    if (summary.errors.length) {
      this.log('---\n');
      for (const err of summary.errors) {
        this.log(err.stack || `${err}`);
      }
    }

    this.log(`Results ${summary.success}/${summary.total}, failed ${summary.fail}, skipped ${summary.skip}`);
  }
}