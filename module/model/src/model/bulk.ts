export interface BulkState<T> {
  insert?: T[];
  update?: T[];
  upsert?: T[];
  delete?: T[];
}

export interface BulkResponse {
  error?: any[];
  count?: {
    update?: number,
    insert?: number,
    upsert?: number,
    delete?: number,
    error?: number
  };
}