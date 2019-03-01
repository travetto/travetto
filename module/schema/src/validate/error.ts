import { AppError } from '@travetto/base';
import { ValidationError } from './types';

export class ValidationResultError extends AppError {
  constructor(public errors: ValidationError[]) {
    super('Errors have occurred', 'data', { errors });
  }
}