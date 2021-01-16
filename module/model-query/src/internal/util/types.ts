import { FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/base';
import { PointImpl } from '../model/point';

const st = (t: string, arr: boolean = false) => new Set([arr ? `${t}[]` : t]);

const basic = (type: string) => ({ $ne: st(type), $eq: st(type), $exists: st('boolean') });
const scalar = (type: string) => ({ $in: st(type, true), $nin: st(type, true) });
const str = (type: string) => ({ $regex: new Set(['RegExp', 'string']) });
const comp = (type: string) => ({ $lt: st(type), $lte: st(type), $gt: st(type), $gte: st(type) });
const geo = (type: string) => ({
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
    string: { ...basic('string'), ...scalar('string'), ...str('string') } as Record<string, Set<string>>,
    number: { ...basic('number'), ...scalar('number'), ...comp('number') } as Record<string, Set<string>>,
    boolean: { ...basic('boolean'), ...scalar('boolean') } as Record<string, Set<string>>,
    Date: { ...basic('Date'), ...scalar('Date'), ...comp('Date') } as Record<string, Set<string>>,
    Point: { ...basic('Point'), ...geo('Point') } as Record<string, Set<string>>,
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