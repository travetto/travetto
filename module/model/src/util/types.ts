import { FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/registry';

import { Point } from '../model/where-clause';

export type SimpleType = 'string' | 'number' | 'boolean' | 'Date' | 'Point';

export interface ErrorCollector<T> {
  collect(element: T, message: string): void;
}

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

export const OPERATORS: Record<string, Record<string, Set<string>>> = {
  string: { ...basic('string'), ...scalar('string'), ...str('string') },
  number: { ...basic('number'), ...scalar('number'), ...comp('number') },
  boolean: { ...basic('boolean'), ...scalar('boolean') },
  Date: { ...basic('Date'), ...scalar('Date'), ...comp('Date') },
  Point: { ...basic('Point'), ...geo('Point') },
};

export class TypeUtil {

  static getDeclaredType(f: FieldConfig | Class): SimpleType | undefined {
    const type = 'type' in f ? f.type : f;
    if (type === String) {
      return 'string';
    } else if (type === Number) {
      return 'number';
    } else if (type === Boolean) {
      return 'boolean';
    } else if (type === Date) {
      return 'Date';
    } else if ('type' in f && f.array) {
      return this.getDeclaredType(f.type);
    } else if (type === Point) {
      return 'Point';
    }
  }

  static getActualType(v: any): string {
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