import { Class, AppError } from '@travetto/base';
import { ValidationResultError } from '@travetto/schema';

import { ModelCrudSupport } from './crud';
import { ModelType, OptionalId } from '../types/model';

declare global {
  interface Error { toJSON(sub?: unknown): unknown }
}

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
export interface BulkResponse {
  /**
   * Errors returned
   */
  errors: unknown[];
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
  constructor(public errors: { idx: number, error: Error }[]) {
    super('Bulk processing errors have occurred', 'data', { errors });
  }

  /**
   * Provide full results back, with validation errors
   */
  toJSON(extra: Record<string, unknown> = {}) {
    return {
      ...extra,
      at: new Date(),
      message: this.message,
      category: this.category,
      type: this.type,
      errors: this.errors.map(x => {
        const { message, type, errors, payload } = x.error as ValidationResultError;
        return { message, type, errors: errors ?? payload, idx: x.idx };
      })
    };
  }
}

/**
 * Determines if model allows for bulk operations
 *
 * @concrete ../internal/service/common:ModelBulkSupportTarget
 */
export interface ModelBulkSupport extends ModelCrudSupport {
  processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse>;
}