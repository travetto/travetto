import { type Class, RuntimeError } from '@travetto/runtime';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { ModelType } from '../types/model.ts';

/**
 * Represents when a data item already exists
 */
export class ExistsError extends RuntimeError {
  static for<T extends ModelType>(cls: Class<T>, item: Partial<T>): ExistsError {
    return new ExistsError(cls, ModelRegistryIndex.get(cls).idSource.get(item, { optional: true }) ?? 'unknown');
  }

  constructor(cls: Class | string, id: string, details?: Record<string, unknown>) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} already exists`, {
      category: 'data',
      details: { id, type: typeof cls === 'string' ? cls : cls.name, ...details }
    });
  }
}
