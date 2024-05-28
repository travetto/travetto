export type RestRpcClientOptions = {
  url: string;
  timeout?: number;
  request?: Partial<RequestInit>;
};

export interface RpcRequestUtil {
  registerTimeout<T extends (number | string | { unref(): unknown })>(
    controller: AbortController,
    timeout: number,
    start: (fn: (...args: unknown[]) => unknown, delay: number) => T,
    stop: (val: T) => void
  ): void;
  exec<T = unknown>(opts: RestRpcDecoratorOptions, ...args: unknown[]): Promise<T>;
  getBody(res: Response): Promise<string | object | undefined>;
  getError(payload: object): Promise<Error>;
  getRequestOptions(opts: RestRpcDecoratorOptions, ...args: unknown[]): RequestInit;
}

export type RestRpcDecoratorOptions = RestRpcClientOptions & {
  controller: string;
  method: string;
};

export type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];

export type RestRpcClient<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type RestRpcClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    opts: RestRpcClientOptions,
    decorate?: (opts: RestRpcDecoratorOptions) => R
  ) => RestRpcClient<T, R>;

export function restRpcClientFactory<T extends Record<string, {}>>(): RestRpcClientFactory<T>;