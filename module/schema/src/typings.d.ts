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
  from<T>(this: { new(...args: any[]): T }, data: DeepPartial<T> & Record<string, any>, view?: string): T;
  fromRaw<T>(this: { new(...args: any[]): T }, data: DeepPartialRaw<T> & Record<string, any>, view?: string): T;
}