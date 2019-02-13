import { AppError } from '@travetto/base';

export type ValidationError = { message: string, path: string, kind: string };

export class ValidationErrors extends AppError {

  constructor(public errors: ValidationError[]) {
    super('Errors have occurred', 'data');
  }

  toJSON(extra?: any) {
    return JSON.stringify({
      message: this.message,
      errors: this.errors,
      type: this.name,
      ...(extra || {})
    });
  }
}