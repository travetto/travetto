import { type Class, RuntimeError } from '@travetto/runtime';

/**
 * Represents when a model of cls and id cannot be found
 */
export class NotFoundError extends RuntimeError {
  constructor(cls: Class | string, id: string, details: Record<string, unknown> = {}) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, { category: 'notfound', details });
  }
}