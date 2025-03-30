import { DataUtil } from '@travetto/schema';

/**
 * @concrete #PointImpl
 */
export type Point = [number, number];

const InvalidSymbol = Symbol();

export class PointImpl {
  static validateSchema(input: unknown): 'type' | undefined {
    const ret = this.bindSchema(input);
    return ret !== InvalidSymbol && ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }

  static bindSchema(input: unknown): [number, number] | typeof InvalidSymbol | undefined {
    if (Array.isArray(input) && input.length === 2) {
      const [a, b] = input.map(x => DataUtil.coerceType(x, Number, false));
      return [a, b];
    } else {
      return InvalidSymbol;
    }
  }
}