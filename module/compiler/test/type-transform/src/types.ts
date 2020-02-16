/**
 * Simple interface
 */
export interface Simple {
  name: string;
  age?: number;
}

/**
 * Super cool comments
 */
export class Concrete {
  color: 'red' | 'green' | 'blue';
  size: number;
}

/** @alias trv/Custom */
export function Custom(): MethodDecorator {
  return () => { };
}