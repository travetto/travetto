/**
 * Test Run
 */
export type TestRun = {
  /**
   * Import for run
   */
  import: string;
  /**
   * Suite class id
   */
  classId?: string;
  /**
   * Methods names we want to target
   */
  methodNames?: string[];
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