import { AllSuitesResult, SuiteResult, SuiteConfig, TestResult, TestConfig } from '../../model';

export type ListenEvent =
  { type: 'test', phase: 'before', test: TestConfig } |
  { type: 'test', phase: 'after', test: TestResult } |
  { type: 'suite', phase: 'before', suite: SuiteConfig } |
  { type: 'suite', phase: 'after', suite: SuiteResult }

export interface Listener {
  onEvent(e: ListenEvent): void;
}