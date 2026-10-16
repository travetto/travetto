import { type Class, RuntimeError } from '@travetto/runtime';

import { ModelRegistryIndex } from '../registry/registry-index';
import type { ModelType } from '../types/model';

/**
 * Represents when a data item already exists
 */
export class ExistsError extends RuntimeError {
  static from<T extends ModelType>(cls: Class<T>, idOrItem: Partial<T>): ExistsError {
    return new ExistsError(cls, ModelRegistryIndex.getIdSource(cls).getOptionalValue(idOrItem) ?? 'unknown');
  }

  constructor(cls: Class | string, id: string, details?: Record<string, unknown>) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} already exists`, {
      category: 'data',
      details: { id, type: typeof cls === 'string' ? cls : cls.name, ...details }
    });
  }
}
