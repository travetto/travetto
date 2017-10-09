export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = FieldComparableType | string | boolean;
export type FieldArrayType = FieldType[];

export function isFieldQuery(o: any): o is FieldQuery {
  return o.lt || o.lte || o.gt || o.gte || o.eq || o.ne || o.in || o.nin || o.exists;
}

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
  { geoWithin: [number, number][] } |
  { geoIntersects: [number, number][] } |
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