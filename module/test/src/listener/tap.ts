import { AllSuitesResult, TestResult } from '../model';
import { Listener, ListenEvent } from '../service';
import { Collector, CollectionComplete } from './collector';

export class TapListener implements CollectionComplete {
  private count = 0;

  constructor(private stream: NodeJS.WriteStream = process.stdout) {
    this.log('TAP version 13');
  }

  private log(message: string) {
    this.stream.write(message + '\n')
  }

  onEvent(e: ListenEvent) {
    if (e.type === 'test' && e.phase === 'after') {
      let { test } = e;
      let message = `ok ${++this.count} - ${test.suiteName} - ${test.method}`;
      if (test.description) {
        message += `: ${test.description}`;
      }
      if (test.status === 'skipped') {
        message += ' # SKIPPED ';
      } else if (test.status === 'failed') {
        message = 'not ' + message;
      }
      this.log(message);
      if (test.status === 'failed') {
        this.log(`
  ---
  message: ${test.error}
  ...
  `)
      }
    }
  }

  onComplete(collector: Collector) {
    this.log(`1..${collector.allSuites.total}`);
  }
}