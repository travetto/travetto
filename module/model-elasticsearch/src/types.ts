type Agg =
  Record<string, {
    buckets: { doc_count: number, key: string }[];
  }>;

export interface SearchResponse<T> {
  body: {
    _scroll_id?: string;
    hits: {
      total: number;
      hits: {
        _source: T;
        _index: string;
        _id: string;
        type: string;
      }[];
    };

    aggregations: Agg;
    aggs: Agg;
  };
}