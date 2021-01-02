import { Util } from '@travetto/base';

export class Point {
  static validateSchema(input: any) {
    const ret = this.bindSchema(input);
    return ret && !isNaN(ret[0]) && !isNaN(ret[1]) ? undefined : 'type';
  }
  static bindSchema(input: any): [number, number] | undefined {
    if (Array.isArray(input) && input.length === 2) {
      return input.map(x => Util.coerceType(x, Number, false)) as [number, number];
    }
  }
}
