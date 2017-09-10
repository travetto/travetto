export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = string | number | boolean | Date | object;
export type FieldArrayType = FieldType[];

export function isSubQuery(o: any): o is SubQuery {
  return o.$lt || o.$lte || o.$gt || o.$gte || o.$eq || o.$ne || o.$in || o.$nin || o.$exists;
}

export type SubQuery = {
  $lt: FieldComparableType;
  $lte?: FieldComparableType;
  $gt?: FieldComparableType;
  $gte?: FieldComparableType;
  $eq?: FieldType;
  $ne?: FieldType;
  $in?: FieldArrayType;
  $nin?: FieldArrayType;
  $exists?: boolean;
}

export type Query = {
  [key: string]: FieldType | RegExp | SubQuery;
} & {
    $and?: Query[],
    $or?: Query[]
  };


export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}

export type ModelId = string | number;