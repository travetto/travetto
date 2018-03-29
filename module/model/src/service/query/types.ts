import { FieldConfig } from '@travetto/schema';

export type SimpleType = 'string' | 'number' | 'boolean' | 'Date' | 'Point';

export interface ErrorCollector<T> {
  collect(element: T, message: string): void;
}

const st = (t: string, arr: boolean = false) => new Set([arr ? `${t}[]` : t]);

const basic = (type: string) => ({ $ne: st(type), $eq: st(type), $exists: st(type) });
const scalar = (type: string) => ({ $in: st(type, true), $nin: st(type, true) });
const str = (type: string) => ({ $regex: st('RegExp') });
const comp = (type: string) => ({ $lt: st(type), $lte: st(type), $gt: st(type), $gte: st(type) });
const geo = (type: string) => ({ $geoWithin: st(type, true), $geoIntersects: st(type, true) });

export const OPERATORS: { [key: string]: { [key: string]: Set<string> } } = {
  string: { ...basic('string'), ...scalar('string'), ...str('string') },
  number: { ...basic('number'), ...scalar('number'), ...comp('number') },
  boolean: { ...basic('boolean'), ...scalar('boolean') },
  Date: { ...basic('Date'), ...scalar('Date'), ...comp('Date') },
  Point: { ...basic('Point'), ...geo('Point') },
}

export class TypeUtil {

  static getDeclaredType(f: FieldConfig) {
    const type = f.declared.type;
    if (type === String) {
      return 'string';
    } else if (f.declared.array && type === Number) {
      return 'Point';
    } else if (type === Number) {
      return 'number';
    } else if (type === Boolean) {
      return 'boolean';
    } else if (type === Date) {
      return 'Date';
    }
  }

  static getActualType(v: any): string {
    const type = typeof v;
    if (['string', 'number', 'boolean'].includes(type)) {
      return type;
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
    throw new Error(`Unknown type for ${v}`)
  }
}