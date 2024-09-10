export type ClientOptions = {
  url: string;
  timeout?: number;
  request?: Partial<Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }>;
};

export type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];

export type Client<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type ClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    opts: ClientOptions,
    decorate?: (opts: ClientOptions, target: string) => R
  ) => Client<T, R>;

type BasicResponse = {
  text(): (string | Promise<string>);
  ok: boolean;
  body?: unknown;
  statusText?: string;
  status?: number;
};

export function IGNORE<T>(): T;
export function clientFactory<T extends Record<string, {}>>(): ClientFactory<T>;
export function callRpc<T = unknown>(opts: ClientOptions, ...args: unknown[]): Promise<T>;
export function onResponse<T = unknown>(res: BasicResponse): Promise<T>;
export function getBody(res: BasicResponse): Promise<string | object | undefined>;
export function getError(payload: object): Promise<Error>;
