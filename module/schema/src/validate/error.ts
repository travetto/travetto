import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ValidationError } from './types';

/**
 * Validation results error.
 *
 * Hold all the validation errors for a given schema validation
 */
export class ValidationResultError extends AppError {
  constructor(public errors: ValidationError[]) {
    super('Validation errors have occurred', 'data', { errors });
  }
}


/**
 * Represents when a requested objects's type doesn't match the class being used to request.
 * Primarily applies to polymorphic types
 */
export class TypeMismatchError extends AppError {
  constructor(cls: Class | string, type: string) {
    super(`Expected ${typeof cls === 'string' ? cls : cls.name} but found ${type}`, 'data');
  }
}