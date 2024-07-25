import { DataUtil } from '@travetto/runtime';

/**
 * @concrete #PointImpl
 */
export type Point = [number, number];

const INVALID = Symbol.for('invalid-point');

export class PointImpl {
  static validateSchema(input: unknown): 'type' | undefined {
    const ret = this.bindSchema(input);
    return ret !== INVALID && ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }

  static bindSchema(input: unknown): [number, number] | typeof INVALID | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return input.map(x => DataUtil.coerceType(x, Number, false)) as [number, number];
    } else {
      return INVALID;
    }
  }
}