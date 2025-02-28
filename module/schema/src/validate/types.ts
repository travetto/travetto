export type ValidationKindCore = 'required' | 'match' | 'min' | 'max' | 'minlength' | 'maxlength' | 'enum' | 'type';
export type ValidationKind = ValidationKindCore | string;

/**
 * Individual Validation Error
 * @concrete
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
  value?: unknown;
  /**
   * Regular expression to match
   */
  re?: string;
  /**
   * Number to compare against
   */
  n?: number | Date;
  /**
   * The type of the field
   */
  type?: string;
}

/**
 * Validation result, will be used to create a validation error
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
  value?: unknown;
  /**
   * The type function or name
   */
  type?: Function | string;
  /**
   * Potential regular expression for the result
   */
  re?: RegExp;
  /**
   * Number to compare against
   */
  n?: number | Date;
}

type OrPromise<T> = T | Promise<T>;

/**
 * Validator function
 */
export type ValidatorFn<T, U> = (value: T, parent?: U) => OrPromise<ValidationError | ValidationError[] | undefined>;

/**
 * Method Validator function
 */
export type MethodValidatorFn<T extends unknown[]> = (...value: T) => OrPromise<ValidationError | ValidationError[] | undefined>;
