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
  } |
  T;

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

type _PropWhereClause<T> = {
  [P in keyof T]?:
  (T[P] extends (Date | number | undefined) ? ComparableFieldQuery<T[P]> :
    (T[P] extends Point | undefined ? GeoFieldQuery :
      (T[P] extends string | undefined ? StringFieldQuery :
        (T[P] extends (infer U)[] | undefined ? ArrayFieldQuery<U> :
          (T[P] extends boolean | undefined ? (GeneralFieldQuery<T[P]> | boolean) :
            (T[P] extends object | undefined ? _PropWhereClause<RetainFields<T[P]>> : never))))));
}

export type _WhereClause<T> =
  _PropWhereClause<T> &
  {
    $and?: _WhereClause<T>[]
    $or?: _WhereClause<T>[];
    $not?: _WhereClause<T>;
  };

export type WhereClause<T> = _WhereClause<RetainFields<T>>;