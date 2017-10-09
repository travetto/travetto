export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = FieldComparableType | string | boolean;
export type FieldArrayType = FieldType[];

export type Point = [number, number];

type GeneralFieldQuery =
  { $eq: FieldType; } |
  { $ne: FieldType; } |
  { $in: FieldArrayType; } |
  { $nin: FieldArrayType; } |
  { $exists: boolean; };

type ComparableFieldQuery =
  { $lt: FieldComparableType; } |
  { $lte: FieldComparableType; } |
  { $gt: FieldComparableType; } |
  { $gte: FieldComparableType; };

type ArrayFieldQuery =
  { $all: FieldArrayType; };

type StringFieldQuery =
  { $regex: RegExp; };

type GeoFieldQuery =
  { $geoWithin: Point[]; } |
  { $geoIntersects: Point[] };

type FieldQuery = GeneralFieldQuery | ComparableFieldQuery | ArrayFieldQuery | StringFieldQuery | GeoFieldQuery;

export type MatchQuery<T> = {
  [P in keyof T]?: FieldQuery | T[P] | MatchQuery<T[P]>;
};

export type GroupingQuery<T> =
  { and: (GroupingQuery<T> | MatchQuery<T>)[]; } |
  { or: (GroupingQuery<T> | MatchQuery<T>)[]; } |
  { not: (GroupingQuery<T> | MatchQuery<T>); };

export type WhereClause<T> = GroupingQuery<T> | MatchQuery<T>;

export function isWhereQuery<T>(o: WhereClause<T>): o is GroupingQuery<T> {
  return 'and' in o || 'or' in o || 'not' in o;
}

export function isFieldType(o: any): o is FieldType {
  let type = typeof o;
  return o === 'number' || o === 'string' || o === 'boolean' || o instanceof Date;
}

export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}