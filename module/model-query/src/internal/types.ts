import type { SchemaFieldConfig, Point } from '@travetto/schema';
import { castTo, type Class, toConcrete } from '@travetto/runtime';

const st = (value: string | string[], isArray: boolean = false): Set<string> =>
  new Set((Array.isArray(value) ? value : [value]).map(item => isArray ? `${item}[]` : item));

const basic = (types: Set<string>): Record<string, Set<string>> => ({ $ne: types, $eq: types, $exists: st('boolean') });
const scalar = (types: Set<string>): Record<string, Set<string>> => ({ $in: types, $nin: types });
const str = (): Record<string, Set<string>> => ({ $regex: st(['RegExp', 'string']) });
const comp = (types: Set<string>): Record<string, Set<string>> => ({ $lt: types, $lte: types, $gt: types, $gte: types });
const geo = (type: string): Record<string, Set<string>> => ({
  $near: st(type),
  $maxDistance: st('number'),
  $unit: st('string'),
  $geoWithin: st(type, true),
  $geoIntersects: st(type, true)
});

const PointConcrete = toConcrete<Point>();

const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean', 'bigint'] as const);

/**
 * Basic type support
 */
export class TypeUtil {
  /**
   * Mapping types to various operators
   */
  static OPERATORS = {
    string: { ...basic(st('string')), ...scalar(st('string', true)), ...str() },
    number: { ...basic(st('number')), ...scalar(st('number', true)), ...comp(st('number')) },
    bigint: { ...basic(st('bigint')), ...scalar(st('bigint', true)), ...comp(st('bigint')) },
    boolean: { ...basic(st('boolean')), ...scalar(st('boolean', true)) },
    Date: { ...basic(st('Date')), ...scalar(st('Date', true)), ...comp(st(['string', 'Date'])) },
    Point: { ...basic(st('Point')), ...geo('Point') }
  };

  /**
   * Get declared type of a given field, only for primitive types
   */
  static getDeclaredType(field: SchemaFieldConfig | Function | Class): keyof typeof TypeUtil.OPERATORS | undefined {
    const type = 'type' in field ? field.type : field;
    switch (type) {
      case String: return 'string';
      case Number: return 'number';
      case Boolean: return 'boolean';
      case BigInt: return 'bigint';
      case Date: return 'Date';
      case PointConcrete: return 'Point';
      default: {
        if ('type' in field && field.array) {
          return this.getDeclaredType(field.type);
        }
      }
    }
  }

  /**
   * Get the actual type of a given field, only for primitive types
   */
  static getActualType(value: unknown): string {
    const type = typeof value;
    if (PRIMITIVE_TYPES.has(castTo(type))) {
      return type;
    } else if (value instanceof RegExp) {
      return 'RegExp';
    } else if (value instanceof Date) {
      return 'Date';
    } else if (Array.isArray(value)) {
      const typeString: string = `${this.getActualType(value[0])}[]`;
      if (value.length === 2 && typeString === 'number[]') {
        return 'Point';
      } else {
        return typeString;
      }
    }
    throw new Error(`Unknown type for ${value}`);
  }
}