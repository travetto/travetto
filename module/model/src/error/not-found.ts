import { type Class, RuntimeError } from '@travetto/runtime';

import { ModelRegistryIndex } from '../registry/registry-index';
import type { ModelType } from '../types/model';

/**
 * Represents when a model of cls and id cannot be found
 */
export class NotFoundError extends RuntimeError {
  static from<T extends ModelType>(cls: Class<T>, idOrItem: Partial<T>): NotFoundError {
    return new NotFoundError(cls, ModelRegistryIndex.getIdSource(cls).getOptionalValue(idOrItem) ?? 'unknown');
  }

  constructor(cls: Class | string, id: string, details: Record<string, unknown> = {}) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, { category: 'notfound', details });
  }
}
