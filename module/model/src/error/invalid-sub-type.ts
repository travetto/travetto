import { type Class, RuntimeError } from '@travetto/runtime';

/**
 * Represents when a model subtype class is unable to be used directly
 */
export class SubTypeNotSupportedError extends RuntimeError {
  constructor(cls: Class | string) {
    super(`${typeof cls === 'string' ? cls : cls.name} cannot be used for this operation`, { category: 'data' });
  }
}