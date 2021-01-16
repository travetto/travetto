import type { Class } from '@travetto/base';

type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | undefined) ? (T[P] | undefined) :
    (T[P] extends any[] ? (DeepPartial<T[P][number]> | null | undefined)[] : DeepPartial<T[P]>));
};

declare global {
  interface Function {
    /**
     * Will produce a new instance of this class with the provided data bound to it
     * @param data The data to bind
     * @param view The optional view to limit the bind to
     */
    from<T>(this: Class<T>, data: DeepPartial<T>, view?: string): T;
  }
}