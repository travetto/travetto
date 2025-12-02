import { Class, AppError } from '@travetto/runtime';
import { ValidationError, ValidationResultError } from '@travetto/schema';

import { ModelCrudSupport } from './crud.ts';
import { ModelType, OptionalId } from '../types/model.ts';

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
export class BulkProcessError extends AppError<{ errors: BulkErrorItem[] }> {
  constructor(errors: { idx: number, error: ValidationResultError }[]) {
    super('Bulk processing errors have occurred', {
      category: 'data',
      details: {
        errors: errors.map(x => {
          const { message, type, details: { errors: subErrors } = {} } = x.error;
          return { message, type, errors: subErrors, idx: x.idx };
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