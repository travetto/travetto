import { DataUtil } from '../data';

export class PointImpl {
  static validateSchema(input: unknown): 'type' | undefined {
    const ret = this.bindSchema(input);
    return ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }
  static bindSchema(input: unknown): [number, number] | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return [
        DataUtil.coerceType(input[0], Number, false),
        DataUtil.coerceType(input[1], Number, false)
      ];
    }
  }
}
