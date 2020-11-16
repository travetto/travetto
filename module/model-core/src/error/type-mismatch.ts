import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';

/**
 * Represents when a requested model's type doesn't match the class being used to request.
 * Primarily applies to polymorphic data stores and checking
 */
export class TypeMismatchError extends AppError {
  constructor(cls: Class | string, id: string, type: string) {
    super(`${typeof cls === 'string' ? cls : cls.name} was not found with id ${id} and type ${type}`, 'data');
  }
}