import type { ModelType } from '@travetto/model';

export type ListPageOptions<O = string> = {
  limit?: number;
  offset?: O;
};

export type ListPageResult<T extends ModelType> = {
  items: T[];
  nextOffset?: string;
};
