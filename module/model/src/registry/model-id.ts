import { Util, castKey, castTo, type Any, type Class } from '@travetto/runtime';
import { ValidationResultError } from '@travetto/schema';

import { ExistsError } from '../error/exists.ts';
import { NotFoundError } from '../error/not-found.ts';
import type { ModelIdGenerator, ModelType, OptionalId, PartialWithId } from '../types/model.ts';
import type { ModelIdConfig } from './types.ts';

/**
 * Encapsulates identifier operations for a model class.
 */
export class ModelIdSource<T extends ModelType = Any> {
  #modelClass: Class<T>;
  #validator?: (id: string) => boolean;
  field: [keyof T] extends [never] ? string : Extract<keyof T, string>;
  generator?: ModelIdGenerator;

  constructor(modelClass: Class<T>, config?: ModelIdConfig<T>) {
    this.#modelClass = modelClass;
    this.field = config?.field ?? castTo('id');
    const generator = config?.generator;
    if (generator !== false) {
      this.generator = generator ?? ((): string => Util.uuid(32));
    }
  }

  /**
   * Create a new identifier using the configured generator or default uuid
   */
  create(): string {
    return (this.generator ?? ((): string => Util.uuid(32)))();
  }

  /**
   * Validate whether an identifier is valid
   */
  valid(id: string): boolean {
    return this.#validator ? this.#validator(id) : typeof id === 'string' && id.length > 0;
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

  /**
   * Produce a NotFoundError for an item or identifier
   */
  getNotFoundError(idOrItem: string | T | Partial<T>, details?: Record<string, unknown>): NotFoundError {
    const id = typeof idOrItem === 'string' ? idOrItem : this.getOptionalValue(idOrItem);
    return new NotFoundError(this.#modelClass, id ?? 'unknown', details);
  }

  /**
   * Produce an ExistsError for an item or identifier
   */
  getExistsError(idOrItem: string | T | Partial<T>, details?: Record<string, unknown>): ExistsError {
    const id = typeof idOrItem === 'string' ? idOrItem : this.getOptionalValue(idOrItem);
    return new ExistsError(this.#modelClass, id ?? 'unknown', details);
  }
}
