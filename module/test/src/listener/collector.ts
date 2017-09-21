import { AllSuitesResult, TestResult, SuiteResult } from '../model';
import { Listener } from '../service';

const BASE_COUNT = {

}

export default class Collector extends Listener {

  tests: TestResult[] = [];
  suites: SuiteResult[] = [];
  allSuites: AllSuitesResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    suites: []
  };

  onSuiteComplete(suite: SuiteResult) {
    this.suites.push(suite);
    this.merge(suite);
  }

  onTestComplete(test: TestResult) {
    this.tests.push(test);
  }

  merge(src: SuiteResult) {
    this.allSuites.suites.push(src);
    this.allSuites.failed += src.failed;
    this.allSuites.passed += src.passed;
    this.allSuites.skipped += src.skipped;
    this.allSuites.total += src.total;
  }
}
