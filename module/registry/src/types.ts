/**
 * A change event
 */
export type ChangeEvent<T> =
  { type: 'update', previous: T, current: T } |
  { type: 'create', current: T } |
  { type: 'delete', previous: T };

/**
 * Change handler
 */
export type ChangeHandler<T> = (event: ChangeEvent<T>) => unknown;

/**
 * Change source
 */
export interface ChangeSource<T> {
  on(callback: ChangeHandler<T>): void;
}