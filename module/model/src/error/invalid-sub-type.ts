import { Class, AppError } from '@travetto/base';

/**
 * Represents when a model subtype class is unable to be used directly
 */
export class SubTypeNotSupportedError extends AppError {
  constructor(cls: Class | string) {
    super(`${typeof cls === 'string' ? cls : cls.name} cannot be used for this operation`, 'data');
  }
}