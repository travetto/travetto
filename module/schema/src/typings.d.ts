type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
} & {
    [key: string]: any;
  };

declare interface Function {
  from<U>(
    this: { new(...args: any[]): U },
    data: DeepPartial<U>,
    view?: string
  ): U;
}
