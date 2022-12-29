import { ObjectUtil } from '@travetto/base';

export class PointImpl {
  static validateSchema(input: unknown): 'type' | undefined {
    const ret = this.bindSchema(input);
    return ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }
  static bindSchema(input: unknown): [number, number] | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return [
        ObjectUtil.coerceType(input[0], Number, false),
        ObjectUtil.coerceType(input[1], Number, false)
      ];
    }
  }
}
