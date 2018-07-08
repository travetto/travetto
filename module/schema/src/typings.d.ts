type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
} & {
    [key: string]: any;
  };

declare interface Function {
  from<T>(this: { new(...args: any[]): T }, data: Partial<T>, view?: string): T;
}