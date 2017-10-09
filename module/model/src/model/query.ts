export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = FieldComparableType | string | boolean;
export type FieldArrayType = FieldType[];

export type Point = [number, number];

export type FieldQuery = {
  lt?: FieldComparableType;
  lte?: FieldComparableType;
  gt?: FieldComparableType;
  gte?: FieldComparableType;
  eq?: FieldType;
  ne?: FieldType;
  in?: FieldArrayType;
  nin?: FieldArrayType;
  all?: FieldArrayType;
  exists?: boolean;
  regex?: RegExp;
  geoWithin?: Point[];
  geoIntersects?: Point[];
}

export type MatchQuery = {
  [key: string]: FieldQuery | FieldType;
};

export type GroupingQuery =
  { and: (GroupingQuery | MatchQuery)[]; } |
  { or: (GroupingQuery | MatchQuery)[]; } |
  { not: (GroupingQuery | MatchQuery); };

export type Query = GroupingQuery | MatchQuery;

export function isQuery(o: Query): o is GroupingQuery {
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