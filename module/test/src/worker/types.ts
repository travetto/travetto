import { TestEvent, TestRemoveEvent } from '../model/event.ts';

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

export type TestRunEvent = { type: 'runTest', import: string };

export const isTestRunEvent = (event: unknown): event is TestRunEvent =>
  typeof event === 'object' && !!event && 'type' in event && event.type === 'runTest';

export type TestReadyEvent = { type: 'ready' };
export type TestLogEvent = { type: 'log', message: string };

export type TestWatchEvent =
  TestEvent |
  TestRemoveEvent |
  TestReadyEvent |
  TestLogEvent;
