import { AppError } from '@travetto/base';

// TODO: Document
export type BulkOp<T> =
  { delete?: T } &
  { insert?: T } &
  { update?: T } &
  { upsert?: T };

// TODO: Document
export interface BulkResponse {
  errors: any[];
  insertedIds: Map<number, string>;
  counts: {
    update: number;
    insert: number;
    upsert: number;
    delete: number;
    error: number;
  };
}

// TODO: Document
export class BulkProcessError extends AppError {
  constructor(public errors: { idx: number, error: Error }[]) {
    super('Bulk processing errors have occurred', 'data', { errors });
  }

  toJSON(extra: Record<string, any> = {}) {
    return {
      ...extra,
      message: this.message,
      category: this.category,
      type: this.type,
      errors: this.errors.map(x => {
        const { message, type, errors, payload } = x.error as any;
        return { message, type, errors: errors ?? payload, idx: x.idx };
      })
    };
  }
}