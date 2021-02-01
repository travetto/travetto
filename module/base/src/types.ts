export type ConcreteClass<T = any> = new (...args: any[]) => T;
export type Class<T = any> = abstract new (...args: any[]) => T;
export type ClassInstance<T = any> = T & {
  constructor: ConcreteClass<T> & { ᚕid: string };
};
export type SimpleType = { [key: string]: SimpleType } | SimpleType[] | undefined | null | string | boolean | RegExp | Date | number;
export type SimpleObject = Record<string, SimpleType>;

export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | undefined) ? (T[P] | undefined) :
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};