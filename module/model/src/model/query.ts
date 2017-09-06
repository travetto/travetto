export type SortOptions = { [key: string]: number } | string | string[];

export type FieldComparableType = Date | number;
export type FieldType = string | number | boolean | Date | object;
export type FieldArrayType = FieldType[];

export type Query = {
  [key: string]: (
    {
      $lt: FieldComparableType;
      $lte?: FieldComparableType;
      $gt?: FieldComparableType;
      $gte?: FieldComparableType;
      $eq?: FieldType;
      $ne?: FieldType;
      $in?: FieldArrayType;
      $nin?: FieldArrayType;
      $exists?: boolean;
    } | RegExp | FieldType
  );
} | { $and: Query[] }
  | { $or: Query[] };


export interface QueryOptions {
  sort?: SortOptions;
  limit?: number;
  offset?: number;
}

export type ModelId = string | number;