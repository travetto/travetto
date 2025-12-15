import { Assertion, TestConfig, TestResult } from './test.ts';
import { SuiteConfig, SuiteResult } from './suite.ts';

/**
 * Targets
 */
export type EventEntity = 'test' | 'suite' | 'assertion';

/**
 * Phases
 */
export type EventPhase = 'before' | 'after';

type EventTpl<T extends EventEntity, P extends EventPhase, V extends {}> =
  { type: T, phase: P, metadata?: Record<string, unknown> } & V;

export type TestRemoveEvent = { type: 'removeTest', import: string, classId?: string, methodName?: string, metadata?: Record<string, unknown> };

/**
 * Different test event shapes
 */
export type TestEvent =
  EventTpl<'assertion', 'after', { assertion: Assertion }> |
  EventTpl<'test', 'before', { test: TestConfig }> |
  EventTpl<'test', 'after', { test: TestResult }> |
  EventTpl<'suite', 'before', { suite: SuiteConfig }> |
  EventTpl<'suite', 'after', { suite: SuiteResult }>;