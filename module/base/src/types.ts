export type ConcreteClass<T = any> = new (...args: any[]) => T;
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: ConcreteClass<T> & { ᚕid: string };
};
export type SimpleType = { [key: string]: SimpleType } | SimpleType[] | undefined | null | string | boolean | RegExp | Date | number;
