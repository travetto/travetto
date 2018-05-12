import { RetainFields, Point } from './common';

type GeneralFieldQuery<T> = {
  $eq?: T;
  $ne?: T;
  $exists?: boolean
};

type GeneralScalarFieldQuery<T> =
  GeneralFieldQuery<T> |
  // Array
  {
    $in?: T[];
    $nin?: T[]
  };

type ComparableFieldQuery<T> =
  GeneralScalarFieldQuery<T> |
  {
    $lt?: T;
    $lte?: T;
    $gt?: T;
    $gte?: T;
  };

type ArrayFieldQuery<T> =
  GeneralFieldQuery<T> |
  { $all?: T[]; } |
  T[];

type StringFieldQuery =
  GeneralScalarFieldQuery<string> |
  { $regex?: RegExp; } |
  string;

type GeoFieldQuery =
  GeneralScalarFieldQuery<Point> |
  {
    $geoWithin?: Point[];
    $geoIntersects?: Point[];
  } |
  Point;

export type PropWhereClause<T> = {
  [P in keyof T]?:
  (T[P] extends (number | undefined) ? ComparableFieldQuery<number> | number :
    (T[P] extends (string | undefined) ? StringFieldQuery :
      (T[P] extends (boolean | undefined) ? (GeneralFieldQuery<boolean> | boolean) :
        (T[P] extends (Date | undefined) ? ComparableFieldQuery<Date> | RetainFields<Date> :
          (T[P] extends (Point | undefined) ? GeoFieldQuery :
            (T[P] extends ((infer U)[] | undefined) ? ArrayFieldQuery<U> :
              (T[P] extends (object | undefined) ? PropWhereClause<RetainFields<T[P]>> : never)))))));
}

export type _WhereClause<T> =
  ({ $and: _WhereClause<T>[]; } & { [P in keyof T]?: never }) |
  ({ $or: _WhereClause<T>[]; } & { [P in keyof T]?: never }) |
  ({ $not: _WhereClause<T>; } & { [P in keyof T]?: never }) |
  (PropWhereClause<T> & { $and?: never; $or?: never; $not?: never });

export type WhereClause<T> = _WhereClause<RetainFields<T>>;