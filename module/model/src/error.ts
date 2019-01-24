import { AppError } from '@travetto/base';

export interface ValidationError {
  message: string;
  path: string;
}

export class ValidationErrors extends AppError<ValidationError[]> {
  constructor(public errors: ValidationError[]) {
    super(`Validation Errors`);
  }

  toJSON(extra?: any) {
    return JSON.stringify({
      message: this.message,
      errors: this.errors,
      type: this.name,
      ...(extra || {})
    });
  }

  toString() {
    return this.message + (this.errors && this.errors.length ? `:\n  ${this.errors!.map(x => x.message).join('\n  ')}` : '');
  }
}
