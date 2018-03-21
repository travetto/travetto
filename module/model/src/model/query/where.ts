type Point = [number, number];

type FieldType = string | number | Date | Point;

type GeneralFieldQuery<T> =
  T |
  { $eq: T; } |
  { $ne: T; } |
  { $exists: boolean; };

type GeneralScalarFieldQuery<T> =
  GeneralFieldQuery<T> |
  // Array
  { $in: T[]; } |
  { $nin: T[]; };

type ComparableFieldQuery<T> =
  GeneralScalarFieldQuery<T> |
  { $lt: T; } |
  { $lte: T; } |
  { $gt: T; } |
  { $gte: T; };

type ArrayFieldQuery<T> =
  GeneralFieldQuery<T> |
  { $all: T; };

type StringFieldQuery =
  GeneralScalarFieldQuery<string> |
  { $regex: RegExp; };

type GeoFieldQuery =
  GeneralScalarFieldQuery<Point> |
  { $geoWithin: Point[]; } |
  { $geoIntersects?: Point[]; };

type FieldQuery<T> =
  (T extends string ? StringFieldQuery :
    (T extends (number | Date) ? ComparableFieldQuery<T> :
      (T extends (infer U)[] ? ArrayFieldQuery<U> :
        (T extends Point ? GeoFieldQuery :
          GeneralFieldQuery<T>))));

// Recursive breaks tsc

type _MatchQuery<T> = {
  [P in keyof T]?: T[P] extends (FieldType | any[]) ? FieldQuery<T[P]> : MatchQuery<T[P]>;
};

type _WhereClause<T> =
  { $and: (_WhereClause<T> | _MatchQuery<T>)[]; } |
  { $or: (_WhereClause<T> | _MatchQuery<T>)[]; } |
  { $not: _WhereClause<T>; } |
  _MatchQuery<T>;

export type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];

export type RemoveBad<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type MatchQuery<T> = _MatchQuery<RemoveBad<T>>;
export type WhereClause<T> = _WhereClause<RemoveBad<T>>;