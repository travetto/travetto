import type { WhereClause } from '@travetto/model-query';
import { castKey, castTo, type Any, type Class, Util } from '@travetto/runtime';
import { type SchemaFieldConfig, ValidationResultError } from '@travetto/schema';

import type { ModelId, ModelType, OptionalId, PartialWithId } from '../types/model.ts';

/**
 * Encapsulates identifier operations for a model class.
 */
export class ModelIdSource<T extends ModelType = Any> {
  readonly modelClass: Class<T>;
  readonly idField: SchemaFieldConfig;

  constructor(modelClass: Class<T>, idField: SchemaFieldConfig) {
    this.modelClass = modelClass;
    this.idField = idField;
  }

  get field(): [keyof T] extends [never] ? string : Extract<keyof T, string> {
    return castTo(this.idField.name);
  }

  /**
   * Get identifier generator for the field
   */
  get generator(): () => ModelId {
    return castTo(this.idField.generator ?? Util.uuid);
  }

  /**
   * Extract identifier from an item if present, generating and setting if missing
   */
  getOrSet(item: Partial<T> | PartialWithId<T> | OptionalId<T>): ModelId {
    let identifier: ModelId = castTo(item && typeof item === 'object' ? item[castKey(this.field)] : undefined);
    if (!identifier) {
      this.set(castTo(item), (identifier = this.generator()));
    }
    return identifier;
  }

  /**
   * Extract identifier from an item, throwing a validation error if missing and non-optional
   */
  get(item: Partial<T> | PartialWithId<T>): ModelId;
  get(item: Partial<T> | PartialWithId<T>, config: { optional: false }): ModelId;
  get(item: Partial<T> | PartialWithId<T>, config: { optional: true }): ModelId | undefined;
  get(item: Partial<T> | PartialWithId<T>, config?: { optional: boolean }): ModelId | undefined {
    const identifier = item && typeof item === 'object' ? item[castKey(this.field)] : undefined;
    if (!identifier && config?.optional !== true) {
      throw new ValidationResultError([
        {
          kind: 'required',
          path: castTo(this.field),
          type: 'string',
          message: `${this.field} is required`
        }
      ]);
    }
    return identifier;
  }

  /**
   * Set the identifier on an item
   */
  set(item: Partial<T> | OptionalId<T>, identifier: ModelId): ModelId {
    if (item && typeof item === 'object') {
      castTo<Record<string, unknown>>(item)[this.field] = identifier;
    }
    return identifier;
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
  where(identifier: ModelId): WhereClause<T> {
    return castTo({ [this.field]: identifier });
  }
}
