import type { WhereClause } from '@travetto/model-query';
import { castKey, castTo, type Any, type Class } from '@travetto/runtime';
import { ValidationResultError } from '@travetto/schema';

import type { ModelId, ModelType, OptionalId, PartialWithId } from '../types/model.ts';

/**
 * Encapsulates identifier operations for a model class.
 */
export class ModelIdSource<T extends ModelType = Any> {
  #modelClass: Class<T>;
  field: [keyof T] extends [never] ? string : Extract<keyof T, string>;

  constructor(modelClass: Class<T>, field: Extract<keyof T, string>) {
    this.#modelClass = modelClass;
    this.field = field;
  }

  /**
   * Extract identifier from an item if present
   */
  getOptional(item: Partial<T> | PartialWithId<T> | OptionalId<T>): ModelId | undefined {
    return castTo(item && typeof item === 'object' ? item[castKey(this.field)] : undefined);
  }

  /**
   * Extract identifier from an item if present
   */
  getOrSet(item: Partial<T> | PartialWithId<T> | OptionalId<T>, generate: () => ModelId): ModelId {
    let id: ModelId = castTo(item && typeof item === 'object' ? item[castKey(this.field)] : undefined);
    if (!id) {
      this.set(castTo(item), (id = generate()));
    }
    return id;
  }

  /**
   * Extract identifier from an item, throwing a validation error if missing
   */
  get(item: Partial<T> | PartialWithId<T>): ModelId {
    const id = this.getOptional(item);
    if (!id) {
      throw new ValidationResultError([
        {
          kind: 'required',
          path: castTo(this.field),
          type: 'string',
          message: `${this.field} is required`
        }
      ]);
    }
    return id;
  }

  /**
   * Set the identifier on an item
   */
  set(item: Partial<T> | OptionalId<T>, id: ModelId): ModelId {
    if (item && typeof item === 'object') {
      castTo<Record<string, unknown>>(item)[this.field] = id;
    }
    return id;
  }

  /**
   * Delete the identifier on an item
   */
  clear(item: Partial<T> | PartialWithId<T> | OptionalId<T>): void {
    if (item && typeof item === 'object') {
      delete castTo<Record<string, unknown>>(item)[this.field];
    }
  }

  /**
   * Build an identifier where-clause / filter
   */
  where(id: ModelId): WhereClause<T> {
    return castTo({ [this.field]: id });
  }
}
