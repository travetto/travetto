import { DataUtil } from '../data.ts';

const InvalidSymbol = Symbol();

/**
 * Point Implementation
 */
export class PointImpl {

  /**
   * Validate we have an actual point
   */
  static validateSchema(input: unknown): 'type' | undefined {
    const bound = this.bindSchema(input);
    return bound !== InvalidSymbol && bound && !isNaN(bound[0]) && !isNaN(bound[1]) ? undefined : 'type';
  }

  /**
   * Convert to tuple of two numbers
   */
  static bindSchema(input: unknown): [number, number] | typeof InvalidSymbol | undefined {
    if (Array.isArray(input) && input.length === 2) {
      const [a, b] = input.map(value => DataUtil.coerceType(value, Number, false));
      return [a, b];
    } else {
      return InvalidSymbol;
    }
  }
}

Object.defineProperty(PointImpl, 'name', { value: 'Point' });