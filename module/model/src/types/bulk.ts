import { type Class, RuntimeError } from '@travetto/runtime';
import type { ValidationError, ValidationResultError } from '@travetto/schema';

import type { ModelCrudSupport } from './crud.ts';
import type { ModelType, OptionalId } from '../types/model.ts';

/**
 * Bulk operation. Each operation has a single action and payload
 */
export type BulkOperation<T extends ModelType> =
  { delete?: T } &
  { insert?: OptionalId<T> } &
  { update?: T } &
  { upsert?: OptionalId<T> };

/**
 * Bulk response provides a summary of all the operations
 */
export interface BulkResponse<E = unknown> {
  /**
   * Errors returned
   */
  errors: E[];
  /**
   * Ids that were added
   */
  insertedIds: Map<number, string>;
  /**
   * Counts based on command above
   */
  counts: {
    update: number;
    insert: number;
    upsert: number;
    delete: number;
    error: number;
  };
}

type BulkErrorItem = { message: string, type: string, errors?: ValidationError[], idx: number };

/**
 * Bulk processing error
 */
export class BulkProcessError extends RuntimeError<{ errors: BulkErrorItem[] }> {
  constructor(errors: { idx: number, error: ValidationResultError }[]) {
    super('Bulk processing errors have occurred', {
      category: 'data',
      details: {
        errors: errors.map(error => {
          const { message, type, details: { errors: subErrors } = {} } = error.error;
          return { message, type, errors: subErrors, idx: error.idx };
        })
      }
    });
  }
}

/**
 * Determines if model allows for bulk operations
 *
 * @concrete
 */
export interface ModelBulkSupport extends ModelCrudSupport {
  processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOperation<T>[]): Promise<BulkResponse>;
}