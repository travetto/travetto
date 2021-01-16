import { Util } from '@travetto/base';

export class PointImpl {
  static validateSchema(input: unknown) {
    const ret = this.bindSchema(input);
    return ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }
  static bindSchema(input: unknown): [number, number] | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return input.map(x => Util.coerceType(x, Number, false)) as [number, number];
    }
  }
}
