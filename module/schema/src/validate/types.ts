export type ValidationKind = 'required' | 'match' | 'min' | 'max' | 'minlength' | 'maxlength' | 'enum' | 'type' | string;

/**
 * Individual Validation Error
 */
export interface ValidationError {
  /**
   * The error message
   */
  message: string;
  /**
   * The object path of the error
   */
  path: string;
  /**
   * The kind of validation
   */
  kind: ValidationKind;
  /**
   * The value provided
   */
  value?: any;
  /**
   * Regular expression to match
   */
  re?: string;
  /**
   * The type of the field
   */
  type?: string;
}

/**
 * Validation rresult, will be used to create a validation error
 */
export interface ValidationResult {
  /**
   * The produced message
   */
  message?: string;
  /**
   * Validation Kind
   */
  kind: ValidationKind;
  /**
   * The value provided
   */
  value?: any;
  /**
   * The type function or name
   */
  type?: Function | string;
  /**
   * Potential regular expression for the result
   */
  re?: RegExp;
}

/**
 * Validator function
 */
export type ValidatorFn<T, U> = (value: T, parent?: U) => ValidationError | undefined | Promise<ValidationError | undefined>;
