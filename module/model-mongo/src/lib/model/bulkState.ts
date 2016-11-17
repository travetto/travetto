export interface BulkState<T> {
  upsert?: T[];
  delete?: T[];
  getId: (t: T) => Object;
}

export interface BulkResponse {
  error?: any[];
  count?: {
    update?: number,
    insert?: number,
    delete?: number,
    error?: number
  };
}