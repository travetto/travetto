/**
 * Process status
 */
export type Status = 'init' | 'release' | 'destroy';

/**
 * Listen for changes in status
 */
export type StatusChangeHandler = (status: Status) => unknown;
