import { Util } from '@travetto/base';

/**
 * @concrete .:PointImpl
 */
export type Point = [number, number];

const INVALID = Symbol.for('invalid-point');

export class PointImpl {
  static validateSchema(input: any) {
    const ret = this.bindSchema(input);
    return ret !== INVALID && ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }

  static bindSchema(input: any): [number, number] | typeof INVALID | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return input.map(x => Util.coerceType(x, Number, false)) as [number, number];
    } else {
      return INVALID;
    }
  }
}