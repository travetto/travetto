export interface BulkState<T> {
  insert?: T[];
  update?: T[];
  delete?: T[];
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