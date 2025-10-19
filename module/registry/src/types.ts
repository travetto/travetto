/**
 * A change event
 */
export type ChangeEvent<T> =
  { type: 'changed', prev: T, curr: T } |
  { type: 'added', curr: T } |
  { type: 'removing', prev: T };

/**
 * Change handler
 */
export type ChangeHandler<T> = (e: ChangeEvent<T>) => unknown;

/**
 * Change source
 */
export interface ChangeSource<T> {
  init(): Promise<unknown>;
  on(callback: ChangeHandler<T>): void;
}