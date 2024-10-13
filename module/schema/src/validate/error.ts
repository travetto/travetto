import { Class, AppError } from '@travetto/runtime';
import { ValidationError } from './types';

/**
 * Validation results error.
 *
 * Hold all the validation errors for a given schema validation
 */
export class ValidationResultError extends AppError<{ errors: ValidationError[] }> {
  constructor(errors: ValidationError[]) {
    super('Validation errors have occurred', { category: 'data', details: { errors } });
  }
}

/**
 * Represents when a requested objects's type doesn't match the class being used to request.
 * Primarily applies to polymorphic types
 */
export class TypeMismatchError extends AppError {
  constructor(cls: Class | string, type: string) {
    super(`Expected ${typeof cls === 'string' ? cls : cls.name} but found ${type}`, { category: 'data' });
  }
}

export function isValidationError(err: unknown): err is ValidationError {
  return !!err && err instanceof Error && 'path' in err;
}