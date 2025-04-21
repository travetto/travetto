import { DataUtil } from '../data.ts';

export class PointImpl {
  static validateSchema(input: unknown): 'type' | undefined {
    const value = this.bindSchema(input);
    return value && !isNaN(value[0]) && !isNaN(value[1]) ? undefined : 'type';
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
