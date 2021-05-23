export type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | undefined) ? (T[P] | undefined) :
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};