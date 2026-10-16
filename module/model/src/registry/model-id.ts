import { castKey, castTo, type Any, type Class } from '@travetto/runtime';
import { ValidationResultError } from '@travetto/schema';

import { ExistsError } from '../error/exists.ts';
import { NotFoundError } from '../error/not-found.ts';
import type { ModelType, OptionalId, PartialWithId } from '../types/model.ts';

/**
 * Encapsulates identifier operations for a model class.
 */
export class ModelIdSource<T extends ModelType = Any> {
  #modelClass: Class<T>;
  field: [keyof T] extends [never] ? string : Extract<keyof T, string>;

  constructor(modelClass: Class<T>, field?: Extract<keyof T, string>) {
    this.#modelClass = modelClass;
    this.field = field ?? castTo('id');
  }

  /**
   * Extract identifier from an item if present
   */
  getOptionalValue(item: Partial<T> | PartialWithId<T> | OptionalId<T>): string | undefined {
    return castTo(item && typeof item === 'object' ? item[castKey(this.field)] : undefined);
  }

  /**
   * Extract identifier from an item, throwing a validation error if missing
   */
  getValue(item: Partial<T> | PartialWithId<T>): string {
    const id = this.getOptionalValue(item);
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
  setValue(item: Partial<T> | OptionalId<T>, id: string): void {
    if (item && typeof item === 'object') {
      castTo<Record<string, unknown>>(item)[this.field] = id;
    }
  }

  /**
   * Delete the identifier on an item
   */
  deleteValue(item: Partial<T> | PartialWithId<T> | OptionalId<T>): void {
    if (item && typeof item === 'object') {
      delete castTo<Record<string, unknown>>(item)[this.field];
    }
  }

  /**
   * Build an identifier where-clause / filter
   */
  getWhereClause<W = Record<string, unknown>>(idOrItem: string | T): W {
    const id = typeof idOrItem === 'string' ? idOrItem : this.getOptionalValue(idOrItem);
    return castTo({ [this.field]: id });
  }
}
