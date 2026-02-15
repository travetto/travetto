import { type Class, RuntimeError } from '@travetto/runtime';
import type { ValidationError } from './types.ts';

/**
 * Validation results error.
 *
 * Hold all the validation errors for a given schema validation
 */
export class ValidationResultError extends RuntimeError<{ errors: ValidationError[] }> {
  constructor(errors: ValidationError[]) {
    super('Validation errors have occurred', { category: 'data', details: { errors } });
  }
}

/**
 * Represents when a requested objects's type doesn't match the class being used to request.
 * Primarily applies to polymorphic types
 */
export class TypeMismatchError extends RuntimeError {
  constructor(cls: Class | string, type: string) {
    super(`Expected ${typeof cls === 'string' ? cls : cls.name} but found ${type}`, { category: 'data' });
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return !!error && error instanceof Error && 'path' in error;
}