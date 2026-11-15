import { type Class, RuntimeError, type UnknownRecord } from '@travetto/runtime';

/**
 * Represents when a data item violates a unique constraint or index
 */
export class UniqueError extends RuntimeError {
  constructor(cls: Class | string, constraint: string, details: UnknownRecord = {}) {
    super(`${typeof cls === 'string' ? cls : cls.name} violates unique constraint on ${constraint}`, {
      category: 'data',
      details: { constraint, type: typeof cls === 'string' ? cls : cls.name, ...details }
    });
  }
}
