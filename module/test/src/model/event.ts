import { Assertion, TestConfig, TestResult } from './test';
import { SuiteConfig, SuiteResult } from './suite';

export type TestEvent =
  { type: 'assertion', phase: 'after', assertion: Assertion } |
  { type: 'test', phase: 'before', test: TestConfig } |
  { type: 'test', phase: 'after', test: TestResult } |
  { type: 'suite', phase: 'before', suite: SuiteConfig } |
  { type: 'suite', phase: 'after', suite: SuiteResult };

export const EventEntity = {
  TEST: 'test',
  SUITE: 'suite',
  ASSERTION: 'assertion'
}

export const EventPhase = {
  BEFORE: 'before',
  AFTER: 'after'
}
