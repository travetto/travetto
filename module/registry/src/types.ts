// TODO: Document
export interface Class<T = any> {
  new(...args: any[]): T;
}

export interface ChangeEvent<T> {
  type: 'changed' | 'added' | 'removing';
  prev?: T;
  curr?: T;
}

export interface ChangeSource<T> {
  init(): Promise<any>;
  on(callback: (e: ChangeEvent<T>) => any): void;
  reset(): void;
}