import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

/**
 * Represents when a model of cls and id cannot be found
 */
export class NotFoundError extends AppError {
  constructor(cls: Class | string, id: string) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, 'notfound');
  }
}