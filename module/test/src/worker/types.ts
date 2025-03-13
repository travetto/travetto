import { TestEvent } from '../model/event.ts';
import { TestRun } from '../model/test.ts';

/**
 * Test Run Event Keys
 */
export const Events = {
  RUN: 'run',
  RUN_COMPLETE: 'runComplete',
  INIT: 'init',
  INIT_COMPLETE: 'initComplete',
  READY: 'ready'
};

export type TestRemovedEvent = { type: 'removeTest', method?: string } & TestRun;
export type TestReadyEvent = { type: 'ready' };
export type TestLogEvent = { type: 'log', message: string };

export type TestWatchEvent =
  TestEvent |
  TestRemovedEvent |
  TestReadyEvent |
  TestLogEvent;
