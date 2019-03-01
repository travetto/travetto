export interface ValidationError {
  message: string;
  path: string;
  kind: string;
}
export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined;
