type DeepPartial<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | any[] | undefined) ? (T[P] | undefined) : DeepPartial<T[P]>);
} & {
  [key: string]: any;
};

type DeepPartialRaw<T> = {
  [P in keyof T]?: (T[P] extends (number | string | Date | boolean | any[]) ?
    (number | string | Date | boolean | any[] | undefined) : DeepPartialRaw<T[P]>)
};


declare interface Function {
  /**
   * Will produce a new instace of this class with the provided data bound to it
   * @param data The data to bind
   * @param view The optional view to limit the bind to
   */
  from<T>(this: { new(...args: any[]): T }, data: DeepPartial<T> & Record<string, any>, view?: string): T;
  /**
   * Will produce a new instace of this class with the provided data bound to it. 
   * 
   * This method will allow for less strict typings at compile time.  The runtime behavior is the same.
   * @param data The data to bind
   * @param view The optional view to limit the bind to
   */
  fromRaw<T>(this: { new(...args: any[]): T }, data: DeepPartialRaw<T> & Record<string, any>, view?: string): T;
}