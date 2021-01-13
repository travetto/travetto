/**
 * A basic class, as defined by it's constructor
 */
export type Class<T = any> = abstract new (...args: any[]) => T;

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
  init(): Promise<any>;
  on(callback: (e: ChangeEvent<T>) => any): void;
  reset(): void;
}