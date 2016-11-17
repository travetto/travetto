export type SortOptions = { [key: string]: number } | string | string[];

export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}