import { AllSuitesResult, TestResult, SuiteResult, TestEvent } from '../model';
import { Consumer } from './types';

export class AllResultsCollector implements Consumer {

  public summary: AllSuitesResult = {
    success: 0,
    fail: 0,
    skip: 0,
    total: 0,
    suites: [],
    errors: []
  };

  private merge(src: SuiteResult) {
    this.summary.suites.push(src);
    this.summary.fail += src.fail;
    this.summary.success += src.success;
    this.summary.skip += src.skip;
    this.summary.total += (src.fail + src.success + src.skip);
  }

  onEvent(e: TestEvent) {
    if (e.phase === 'after' && e.type === 'suite') {
      this.merge(e.suite);
    }
  }
}
