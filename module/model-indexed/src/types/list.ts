import type { ModelType } from '@travetto/model';

export interface ModelPageOptions<O = string> {
  batchSizeHint?: number;
  limit?: number;
  offset?: O;
}

/**
 * Result of a page request.
 */
export interface ModelPageResult<T extends ModelType> {
  items: T[];
  nextOffset?: string;
}
