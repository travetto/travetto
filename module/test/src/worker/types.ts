/**
 * Test Run Request
 */
export type RunRequest = {
  file: string;
  class?: string;
  method?: string;
};

/**
 * Test Run Event
 */
export type RunEvent = {
  import: string;
  error?: unknown;
  class?: string;
  method?: string;
};

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