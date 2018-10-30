export type Point = [number, number];

export type Primitive = number | boolean | string | Date | Point;
export type PrimitiveArray = Primitive[];

export type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

export type RetainFields<T> = Pick<T, ValidFieldNames<T>>;

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
  { $exists?: boolean } |
  { $eq?: T | T[] } |
  { $ne?: T | T[] } |
  { $all?: T[]; } |
  PropWhereClause<RetainFields<T>> |
  T | T[];

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
};

export type _WhereClause<T> =
  ({ $and: _WhereClause<T>[]; } & { [P in keyof T]?: never }) |
  ({ $or: _WhereClause<T>[]; } & { [P in keyof T]?: never }) |
  ({ $not: _WhereClause<T>; } & { [P in keyof T]?: never }) |
  (PropWhereClause<T> & { $and?: never; $or?: never; $not?: never });

export type WhereClause<T> = _WhereClause<RetainFields<T>>;