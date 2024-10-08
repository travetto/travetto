import { Class, AppError } from '@travetto/runtime';

/**
 * Represents when a model of cls and id cannot be found
 */
export class NotFoundError extends AppError {
  constructor(cls: Class | string, id: string, details?: unknown) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, 'notfound', details);
  }
}