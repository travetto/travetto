import type { Primitive, TimeSpan } from '@travetto/runtime';
import { Point } from '@travetto/schema';

export type QueryPrimitive = Primitive | Point;
export type QueryPrimitiveArray = QueryPrimitive[];
export type DistanceUnit = 'mi' | 'm' | 'km' | 'ft' | 'rad';

export type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (QueryPrimitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

export type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

type General<T> = {
  $eq?: T;
  $ne?: T;
  $exists?: boolean;
};

type ScalarField<T> = {
  $in?: T[];
  $nin?: T[];
};

type ComparableField<T> = {
  $lt?: T;
  $lte?: T;
  $gt?: T;
  $gte?: T;
};

type ArrayField<T> =
  { $exists?: boolean } |
  { $eq?: T | T[] } |
  { $ne?: T | T[] } |
  { $all?: T[] } |
  { $in?: T[] } |
  PropWhereClause<RetainFields<T>> |
  T | T[];

type StringField = { $regex?: RegExp | string };

type GeoField = {
  $geoWithin?: Point[];
  $near?: Point;
  $maxDistance?: number;
  $unit?: DistanceUnit;
};

export type PropWhereClause<T> = {
  [P in keyof T]?:
  (T[P] extends (number | undefined) ? (General<number> | ScalarField<number> | ComparableField<number> | number) :
    (T[P] extends (string | undefined) ? (General<string> | ScalarField<string> | StringField | string) :
      (T[P] extends (boolean | undefined) ? (General<boolean> | boolean) :
        (T[P] extends (Date | undefined) ? (General<Date> | ScalarField<Date> | ComparableField<Date | TimeSpan> | Date) :
          (T[P] extends (Point | undefined) ? (General<Point> | ScalarField<Point> | GeoField | Point) :
            (T[P] extends ((infer U)[] | undefined) ? ArrayField<U> :
              (T[P] extends (object | undefined) ? PropWhereClause<RetainFields<T[P]>> : never)))))));
};

/**
 * Raw query type
 */
export type WhereClauseRaw<T> =
  ({ $and: WhereClauseRaw<T>[] } & { [P in keyof T]?: never }) |
  ({ $or: WhereClauseRaw<T>[] } & { [P in keyof T]?: never }) |
  ({ $not: WhereClauseRaw<T> } & { [P in keyof T]?: never }) |
  (PropWhereClause<T> & { $and?: never, $or?: never, $not?: never });

/**
 * Full where clause, typed against the input type T
 */
export type WhereClause<T> = WhereClauseRaw<RetainFields<T>>;

/**
 * Provides all the valid string type fields from a given type T
 */
export type ValidStringFields<T> = {
  [K in Extract<keyof T, string>]:
  (T[K] extends (String | string | string[] | String[] | undefined) ? K : never)
}[Extract<keyof T, string>];