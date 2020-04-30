// TODO: Document
export interface ValidationError {
  message: string;
  path: string;
  kind: string;
}

// TODO: Document
export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined | Promise<ValidationError | undefined>;
