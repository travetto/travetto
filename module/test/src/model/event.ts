import { Assertion, TestConfig, TestResult } from './test';
import { SuiteConfig, SuiteResult } from './suite';

/**
 * Targets
 */
export type EventEntity = 'test' | 'suite' | 'assertion';
/**
 * Phases
 */
export type EventPhase = 'before' | 'after';

/**
 * Different test event shapes
 */
export type TestEvent =
  { type: 'assertion', phase: 'after', assertion: Assertion } |
  { type: 'test', phase: 'before', test: TestConfig } |
  { type: 'test', phase: 'after', test: TestResult } |
  { type: 'suite', phase: 'before', suite: SuiteConfig } |
  { type: 'suite', phase: 'after', suite: SuiteResult };
