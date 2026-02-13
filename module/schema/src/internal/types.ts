import { DataUtil } from '../data.ts';
import { SchemaTypeUtil } from '../type-config.ts';

const InvalidSymbol = Symbol();

/**
 * Convert to tuple of two numbers
 */
function bindPoint(input: unknown): [number, number] | typeof InvalidSymbol | undefined {
  if (Array.isArray(input) && input.length === 2) {
    const [a, b] = input.map(value => DataUtil.coerceType(value, Number, false));
    return [a, b];
  } else {
    return InvalidSymbol;
  }
}

/**
 * Validate we have an actual point
 */
function validatePoint(input: unknown): 'type' | undefined {
  const bound = bindPoint(input);
  return bound !== InvalidSymbol && bound && !isNaN(bound[0]) && !isNaN(bound[1]) ? undefined : 'type';
}

/**
 * Point Contract
 */
export class PointContract { }

SchemaTypeUtil.setSchemaTypeConfig(PointContract, {
  validate: validatePoint,
  bind: bindPoint,
});
Object.defineProperty(PointContract, 'name', { value: 'Point' });
