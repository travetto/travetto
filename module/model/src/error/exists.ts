import { Class, AppError } from '@travetto/base';

/**
 * Represents when a data item already exists
 */
export class ExistsError extends AppError {
  constructor(cls: Class | string, id: string) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} already exists`, 'data');
  }
}