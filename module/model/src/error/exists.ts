import { Class, AppError } from '@travetto/runtime';

/**
 * Represents when a data item already exists
 */
export class ExistsError extends AppError {
  constructor(cls: Class | string, id: string) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} already exists`, {
      category: 'data',
      details: { id, type: typeof cls === 'string' ? cls : cls.name }
    });
  }
}