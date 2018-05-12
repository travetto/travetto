export type Point = [number, number];

export type Primitive = number | boolean | string | Date | Point;
export type PrimitiveArray = Primitive[];

export type FieldType = Primitive | object;

export type ValidFieldNames<T> = { [K in keyof T]: T[K] extends Function ? never : (T[K] extends FieldType ? K : never) }[keyof T];

const HIDDEN = Symbol('hidden')

export type RetainFields<T> = T extends { [HIDDEN]?: any } ? T : (Pick<T, ValidFieldNames<T>> & { [HIDDEN]?: any });
