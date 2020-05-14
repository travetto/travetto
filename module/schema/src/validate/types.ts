export type ValidationKind = 'required' | 'match' | 'min' | 'max' | 'minlength' | 'maxlength' | 'enum' | 'type' | string;

// TODO: Document
export interface ValidationError {
  message: string;
  path: string;
  kind: ValidationKind;
  value?: any;
  re?: string;
  type?: string;
}

export interface ValidationResult {
  message?: string;
  kind: ValidationKind;
  value?: any;
  type?: Function | string;
  re?: RegExp;
}

// TODO: Document
export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined | Promise<ValidationError | undefined>;
