/**
 * Simple interface
 */
export interface Simple {
  name: string;
  age?: number;
  sub: {
    orange: 5 | string;
    dob: Date;
  };
}

/**
 * Super cool comments
 */
export class Concrete {
  color: 'red' | 'green' | 'blue';
  size: number;
}

/** @augments trv/Custom */
export function Custom(): MethodDecorator {
  return () => { };
}