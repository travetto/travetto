import { AppError } from '@travetto/base';
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

  toConsole() {
    const sub = this.errors.map(x => `\t[ ${x.kind.padEnd(9)}] ${x.path.padEnd(10)} -- ${x.message}`).join('\n');
    return super.toConsole(`${sub}\n`);
  }
}