/**
 * A change event
 */
export interface ChangeEvent<T> {
  type: 'changed' | 'added' | 'removing';
  prev?: T;
  curr?: T;
}

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
  reset(): void;
}