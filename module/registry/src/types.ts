/**
 * A change event
 */
export type ChangeEvent<T> =
  { type: 'changed', previous: T, current: T } |
  { type: 'added', current: T } |
  { type: 'removing', previous: T };

/**
 * Change handler
 */
export type ChangeHandler<T> = (event: ChangeEvent<T>) => unknown;

/**
 * Change source
 */
export interface ChangeSource<T> {
  init(): Promise<unknown>;
  on(callback: ChangeHandler<T>): void;
}