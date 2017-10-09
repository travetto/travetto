export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = FieldComparableType | string | boolean;
export type FieldArrayType = FieldType[];

export type Point = [number, number];

export type FieldQuery =
  { lt: FieldComparableType; } |
  { lte: FieldComparableType; } |
  { gt: FieldComparableType; } |
  { gte: FieldComparableType; } |
  { eq: FieldType; } |
  { ne: FieldType; } |
  { in: FieldArrayType; } |
  { nin: FieldArrayType; } |
  { all: FieldArrayType; } |
  { exists: boolean; } |
  { regex: RegExp; } |
  { geoWithin: Point[] } |
  { geoIntersects: Point[] } |
  FieldType;

export type Query =
  { and: Query[]; } |
  { or: Query[]; } |
  { not: Query; } |
  { [key: string]: FieldQuery; };

export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}

let q: Query = {
  'name.first': 'orange'
}