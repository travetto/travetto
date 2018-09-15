export type BulkOp<T> = { action: 'insert' | 'update' | 'upsert' | 'delete', payload: T };

export interface BulkResponse {
  errors: any[];
  counts: {
    update: number,
    insert: number,
    upsert: number,
    delete: number,
    error: number
  };
}