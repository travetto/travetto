import { hasProperty } from '@travetto/runtime';

import type { TestEvent, TestRemoveEvent } from '../model/event.ts';

/**
 * Test Run Event Keys
 */
export const TestWorkerEvents = {
  RUN: 'run',
  RUN_COMPLETE: 'runComplete',
  INIT: 'init',
  INIT_COMPLETE: 'initComplete',
  READY: 'ready'
};

export type TestRunEvent = { type: 'runTest'; import: string } | { type: 'runTests'; imports: string[] };

export const isTestRunEvent = (value: unknown): value is TestRunEvent =>
  hasProperty<TestRunEvent>('type', 'runTest')(value) || hasProperty<TestRunEvent>('type', 'runTests')(value);

export type TestReadyEvent = { type: 'ready' };
export type TestLogEvent = { type: 'log'; message: string };

export type TestWatchEvent = TestEvent | TestRemoveEvent | TestReadyEvent | TestLogEvent;
