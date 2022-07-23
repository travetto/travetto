import { FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/base';

import { PointImpl } from '../model/point';

const st = (t: string | string[], arr: boolean = false): Set<string> =>
  new Set((Array.isArray(t) ? t : [t]).map(v => arr ? `${v}[]` : v));

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
    boolean: { ...basic(st('boolean')), ...scalar(st('boolean', true)) },
    Date: { ...basic(st('Date')), ...scalar(st('Date', true)), ...comp(st(['string', 'Date'])) },
    Point: { ...basic(st('Point')), ...geo('Point') }
  };

  /**
   * Get declared type of a given field, only for primitive types
   */
  static getDeclaredType(f: FieldConfig | Class): keyof typeof TypeUtil.OPERATORS | undefined {
    const type = 'type' in f ? f.type : f;
    switch (type) {
      case String: return 'string';
      case Number: return 'number';
      case Boolean: return 'boolean';
      case Date: return 'Date';
      case PointImpl: return 'Point';
      default: {
        if ('type' in f && f.array) {
          return this.getDeclaredType(f.type);
        }
      }
    }
  }

  /**
   * Get the actual type of a given field, only for primitive types
   */
  static getActualType(v: unknown): string {
    const type = typeof v;
    if (['string', 'number', 'boolean'].includes(type)) {
      return type;
    } else if (v instanceof RegExp) {
      return 'RegExp';
    } else if (v instanceof Date) {
      return 'Date';
    } else if (Array.isArray(v)) {
      const ret: string = `${this.getActualType(v[0])}[]`;
      if (v.length === 2 && ret === 'number[]') {
        return 'Point';
      } else {
        return ret;
      }
    }
    throw new Error(`Unknown type for ${v}`);
  }
}