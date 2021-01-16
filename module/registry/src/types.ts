/**
 * A change event
 */
export interface ChangeEvent<T> {
  type: 'changed' | 'added' | 'removing';
  prev?: T;
  curr?: T;
}

/**
 * Change source
 */
export interface ChangeSource<T> {
  init(): Promise<unknown>;
  on(callback: (e: ChangeEvent<T>) => unknown): void;
  reset(): void;
}