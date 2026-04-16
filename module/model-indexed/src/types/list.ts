import type { ModelType } from '@travetto/model';

export interface ModelIndexedSearchOptions {
  batchSizeHint?: number;
  limit?: number;
}

export interface ModelPageOptions<O = string> extends ModelIndexedSearchOptions {
  offset?: O;
}

/**
 * Result of a page request.
 * @virtual true
 */
export interface ModelPageResult<T extends ModelType> {
  items: T[];
  nextOffset?: string;
}
