export type RestRpcClientOptions = {
  url: string;
  timeout?: number;
  request?: Partial<Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }>;
};

export interface RpcRequestUtil {
  exec<T = unknown>(opts: RestRpcClientOptions, ...args: unknown[]): Promise<T>;
  getBody(res: Response): Promise<string | object | undefined>;
  getError(payload: object): Promise<Error>;
}

export type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];

export type RestRpcClient<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type RestRpcClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    opts: RestRpcClientOptions,
    decorate?: (opts: RestRpcClientOptions, target: string) => R
  ) => RestRpcClient<T, R>;

export function restRpcClientFactory<T extends Record<string, {}>>(): RestRpcClientFactory<T>;