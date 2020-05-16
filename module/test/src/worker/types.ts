/**
 * Test Run Event
 */
export type RunEvent = {
  file?: string;
  error?: any;
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