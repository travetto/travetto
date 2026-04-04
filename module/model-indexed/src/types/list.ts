import type { ModelType } from '@travetto/model';

export interface ModelPageOptions<O = string> {
  batchSizeHint?: number;
  offset?: O;
}

export interface ModelPageResult<T extends ModelType> {
  items: T[];
  nextOffset?: string;
}
