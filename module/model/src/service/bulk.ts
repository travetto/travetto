import { Class, AppError } from '@travetto/runtime';
import { ValidationResultError } from '@travetto/schema';

import { ModelCrudSupport } from './crud';
import { ModelType, OptionalId } from '../types/model';

/**
 * Bulk operation. Each operation has a single action and payload
 */
export type BulkOp<T extends ModelType> =
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

/**
 * Bulk processing error
 */
export class BulkProcessError extends AppError {
  constructor(public errors: { idx: number, error: ValidationResultError }[]) {
    super('Bulk processing errors have occurred', 'data', {
      errors: errors.map(x => {
        const { message, type, details: { errors: subErrors } = {}, details } = x.error;
        return { message, type, errors: subErrors ?? details, idx: x.idx };
      })
    });
  }
}

/**
 * Determines if model allows for bulk operations
 *
 * @concrete ../internal/service/common#ModelBulkSupportTarget
 */
export interface ModelBulkSupport extends ModelCrudSupport {
  processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse>;
}