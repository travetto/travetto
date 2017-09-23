import * as yaml from 'js-yaml';

import { AllSuitesResult, TestResult } from '../../model';
import { Listener, ListenEvent } from './listener';
import { Collector, CollectionComplete } from './collector';

export class TapListener implements CollectionComplete {
  private count = 0;

  constructor(private stream: NodeJS.WriteStream = process.stdout) {
    this.log('TAP version 13');
  }

  private log(message: string) {
    this.stream.write(message + '\n')
  }

  logMeta(obj: any) {
    let body = yaml.safeDump(obj, { indent: 2 });
    body = body.split('\n').map(x => `  ${x}`).join('\n');
    this.log(`---\n${body}\n...`);
  }

  onEvent(e: ListenEvent) {
    if (e.type === 'test' && e.phase === 'after') {
      let { test } = e;
      let header = `${test.suiteName} - ${test.method}`;
      if (test.description) {
        header += `: ${test.description}`;
      }
      this.log(`$ ${header}`);
      let message = '';
      if (test.assertions.length) {
        let subCount = 0;
        let count = test.assertions.length;
        for (let a of test.assertions) {
          let subMessage = `ok ${++subCount} - ${a.text} ${a.file}:${a.line}`;
          if (a.error) {
            subMessage = `not ${subMessage}`;
          }
          this.log(`    ${subMessage}`);
        }
        this.log(`    1..${subCount}`);
      }

      let status = `ok ${++this.count} `;
      if (test.status === 'skipped') {
        status += ' # SKIP';
      } else if (test.status === 'failed') {
        status = 'not ' + status;
      }
      status += header;

      this.log(status);

      if (test.status === 'failed' && test.error) {
        this.logMeta({ error: test.error });
      }
      if (test.output) {
        for (let key of ['log', 'info', 'error', 'debug', 'warn']) {
          if (test.output[key]) {
            this.logMeta({ [key]: test.output[key] });
          }
        }
      }
    }
  }

  onComplete(collector: Collector) {
    this.log(`1..${collector.allSuites.total}`);
  }
}