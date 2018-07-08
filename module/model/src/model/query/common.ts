export type Point = [number, number];

export type Primitive = number | boolean | string | Date | Point;
export type PrimitiveArray = Primitive[];

export type ValidFieldNames<T> = {
  [K in keyof T]:
  (T[K] extends (Primitive | undefined) ? K :
    (T[K] extends (Function | undefined) ? never :
      K))
}[keyof T];

export type RetainFields<T> = Pick<T, ValidFieldNames<T>>;