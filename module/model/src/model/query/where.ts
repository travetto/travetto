import { RetainFields, Point, FieldType } from './common';

type GeneralFieldQuery<T> = {
  $eq?: T;
  $ne?: T;
  $exists?: boolean
};

type GeneralScalarFieldQuery<T> =
  GeneralFieldQuery<T> &
  // Array
  {
    $in?: T[];
    $nin?: T[]
  };

type ComparableFieldQuery<T> =
  GeneralScalarFieldQuery<T> &
  {
    $lt?: T;
    $lte?: T;
    $gt?: T;
    $gte?: T;
  };

type ArrayFieldQuery<T> =
  GeneralFieldQuery<T> &
  { $all?: T; };

type StringFieldQuery =
  GeneralScalarFieldQuery<string> &
  { $regex?: RegExp; };

type GeoFieldQuery =
  GeneralScalarFieldQuery<Point> &
  {
    $geoWithin?: Point[];
    $geoIntersects?: Point[];
  };

type FieldQuery<T> =
  (T extends (number | Date) ? ComparableFieldQuery<T> :
    (T extends string ? StringFieldQuery :
      (T extends Point ? GeoFieldQuery :
        (T extends (infer U)[] ? ArrayFieldQuery<U> :
          (T extends Function ? never :
            GeneralFieldQuery<T>))))) | T;

type _MatchQuery<T> = {
  [P in keyof T]?: T[P] extends object ? _MatchQuery<T[P]> : FieldQuery<T[P]>;
} & { $and?: never, $or?: never, $not?: never };

type _WhereClause<T> =
  ({
    $and?: (_MatchQuery<T> | _WhereClause<T>)[];
    $or?: (_MatchQuery<T> | _WhereClause<T>)[];
    $not?: (_MatchQuery<T> | _WhereClause<T>);
  }) &
  { [P in keyof T]?: never };

export type MatchQuery<T> = _MatchQuery<RetainFields<T>>;
export type WhereClause<T> = _WhereClause<RetainFields<T>> | _MatchQuery<RetainFields<T>>;