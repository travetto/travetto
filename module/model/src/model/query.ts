export type SortOptions = { [key: string]: number } | string | string[];

export type Query<T> = {
  [p in keyof T]?: T[p]
  | { $lt: T[p] }
  | { $lte: T[p] }
  | { $gt: T[p] }
  | { $gte: T[p] }
  | { $eq: T[p] }
  | { $ne: T[p] }
  | { $in: T[p][] }
  | { $nin: T[p][] }
  | { $exists: boolean }
  | RegExp;
}
  & { $and?: Query<T>[] }
  & { $or?: Query<T>[] };

export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}

export type ModelId = string | number;