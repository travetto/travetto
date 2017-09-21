import { AllSuitesResult, SuiteResult, SuiteConfig, TestResult, TestConfig } from '../index';


export type ListenEvent =
  { type: 'test', phase: 'before', test: TestConfig } |
  { type: 'test', phase: 'after', test: TestResult } |
  { type: 'suite', phase: 'before', suite: SuiteConfig } |
  { type: 'suite', phase: 'after', suite: SuiteResult }

export abstract class Listener {

  onTestStart(test: TestConfig) {

  }

  onTestComplete(test: TestResult) {

  }

  onSuiteStart(suite: SuiteConfig) {

  }

  onSuiteComplete(suite: SuiteResult) {

  }

  onAllSuitesComplete(suites: AllSuitesResult) {

  }

  onMerge(suites: AllSuitesResult) {

  }

  onEvent(e: ListenEvent) {
    if (e.phase === 'after') {
      e.type === 'test' ?
        this.onTestComplete(e.test) :
        this.onSuiteComplete(e.suite);
    } else {
      e.type === 'test' ?
        this.onTestStart(e.test) :
        this.onSuiteStart(e.suite);
    }
  }

  complete() { }
}