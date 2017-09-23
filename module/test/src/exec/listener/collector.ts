import { AllSuitesResult, TestResult, SuiteResult } from '../../model';
import { Listener, ListenEvent } from './listener';

export interface CollectionComplete extends Listener {
  onComplete(collector: Collector): void;
}

export class Collector implements Listener {

  allSuites: AllSuitesResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
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
    this.allSuites.failed += src.failed;
    this.allSuites.passed += src.passed;
    this.allSuites.skipped += src.skipped;
    this.allSuites.total += src.total;
  }
}
