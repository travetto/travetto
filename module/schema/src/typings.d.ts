import type { Class, DeepPartial } from '@travetto/base';

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