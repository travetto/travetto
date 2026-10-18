import { type Class, RuntimeError } from '@travetto/runtime';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { ModelType } from '../types/model.ts';

/**
 * Represents when a model of cls and id cannot be found
 */
export class NotFoundError extends RuntimeError {
  static for<T extends ModelType>(cls: Class<T>, item: Partial<T>): NotFoundError {
    return new NotFoundError(cls, ModelRegistryIndex.get(cls).idSource.get(item, { optional: true }) ?? 'unknown');
  }

  constructor(cls: Class | string, id: string, details: Record<string, unknown> = {}) {
    super(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, { category: 'notfound', details });
  }
}
