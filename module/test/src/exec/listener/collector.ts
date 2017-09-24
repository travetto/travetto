import { AllSuitesResult, TestResult, SuiteResult } from '../../model';
import { Listener, ListenEvent } from './listener';

export interface CollectionComplete extends Listener {
  onComplete(collector: Collector): void;
}

export class Collector implements Listener {

  allSuites: AllSuitesResult = {
    success: 0,
    fail: 0,
    skip: 0,
    total: 0,
    suites: []
  };

  onEvent(e: ListenEvent) {
    if (e.phase === 'after' && e.type === 'suite') {
      this.merge(e.suite);
    }
  }

  private merge(src: SuiteResult) {
    this.allSuites.suites.push(src);
    this.allSuites.fail += src.fail;
    this.allSuites.success += src.success;
    this.allSuites.skip += src.skip;
    this.allSuites.total += src.total;
  }
}
