
export type SimpleType = 'string' | 'number' | 'boolean' | 'Date' | 'GeoPoint';

export interface ProcessingHandler<S, V = any> {
  preMember?(state: S): boolean | undefined;
  onSimpleType(state: S, type: SimpleType, value: V): void;
  onArrayType?(state: S, target: any): void;
  onComplexType?(state: S): boolean | undefined;
}

export interface ErrorCollector<T> {
  collect(element: T, message: string): void;
}

export const QUERY_TYPES = [
  'Query', 'ModelQuery', 'PageableModelQuery'
].reduce((acc, v) => { acc[v] = true; return acc; }, {} as { [key: string]: boolean });

export const OPERATORS: { [key: string]: { type: SimpleType, ops: { [key: string]: Set<string> } } } = {
  string: {
    type: 'string',
    ops: {
      $ne: new Set(['string']), $eq: new Set(['string']),
      $exists: new Set(['boolean']), $in: new Set(['string[]']),
      $nin: new Set(['string[]']), $regex: new Set(['string', 'RegEx'])
    }
  },
  number: {
    type: 'number',
    ops: {
      $ne: new Set(['number']), $eq: new Set(['number']),
      $exists: new Set(['boolean']), $in: new Set(['number[]']), $nin: new Set(['number[]']),
      $lt: new Set(['number']), $gt: new Set(['number']), $lte: new Set(['number']), $gte: new Set(['number'])
    }
  },
  boolean: {
    type: 'boolean',
    ops: {
      $ne: new Set(['boolean']), $eq: new Set(['boolean']), $exists: new Set(['boolean']),
      $in: new Set(['boolean[]']), $nin: new Set(['boolean[]'])
    }
  },
  date: {
    type: 'Date',
    ops: {
      $ne: new Set(['Date']), $eq: new Set(['Date']), $exists: new Set(['boolean']),
      $in: new Set(['Date[]']), $nin: new Set(['Date[]']),
      $lt: new Set(['Date']), $gt: new Set(['Date']),
      $lte: new Set(['Date']), $gte: new Set(['Date'])
    }
  },
  geo: {
    type: 'GeoPoint',
    ops: {
      $ne: new Set(['GeoPoint']), $eq: new Set(['GeoPoint']), $exists: new Set(['boolean']),
      $in: new Set(['GeoPoint[]']), $nin: new Set(['GeoPoint[]']),
      $geoWithin: new Set('GeoPoint[]'), $geoIntersects: new Set(['GeoPoint[]'])
    }
  }
}

