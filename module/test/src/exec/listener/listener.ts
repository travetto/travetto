import { AllSuitesResult, SuiteResult, SuiteConfig, TestResult, TestConfig, Assertion } from '../../model';

export type ListenEvent =
  { type: 'assertion', phase: 'after', assert: Assertion } |
  { type: 'test', phase: 'before', test: TestConfig } |
  { type: 'test', phase: 'after', test: TestResult } |
  { type: 'suite', phase: 'before', suite: SuiteConfig } |
  { type: 'suite', phase: 'after', suite: SuiteResult }

export interface Listener {
  onEvent(e: ListenEvent): void;
}