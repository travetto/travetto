import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ValidationResultError } from '@travetto/schema';
import { ModelCore } from './core';
import { ModelType } from '../types/model';

/**
 * Bulk operation. Each operation has a single action and payload
 */
export type BulkOp<T> =
  { delete?: T } &
  { insert?: T } &
  { update?: T } &
  { upsert?: T };

/**
 * Bulk response provides a summary of all the operations
 */
export interface BulkResponse {
  /**
   * Errors returned
   */
  errors: any[];
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
  toJSON(extra: Record<string, any> = {}) {
    return {
      ...extra,
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
 */
export interface ModelBulkable extends ModelCore {
  bulkProcess<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse>;
}