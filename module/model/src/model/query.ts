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
  | RegExp;
}