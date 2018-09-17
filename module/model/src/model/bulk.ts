export type BulkOp<T> =
  { delete?: T; } &
  { insert?: T; } &
  { update?: T; } &
  { upsert?: T; };

export interface BulkResponse {
  errors: any[];
  counts: {
    update: number;
    insert: number;
    upsert: number;
    delete: number;
    error: number;
  };
}