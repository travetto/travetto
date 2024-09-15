type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];

export type ClientOptions = {
  url: string;
  timeout?: number;
  request?: Partial<Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }>;
};

export type Client<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type ClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    baseOpts: ClientOptions,
    decorate?: (opts: ClientOptions, target: string) => R
  ) => Client<T, R>;


function registerTimeout<T extends (number | string | { unref(): unknown })>(
  controller: AbortController,
  timeout: number,
  start: (fn: (...args: unknown[]) => unknown, delay: number) => T,
  stop: (val: T) => void
): void {
  const timer = start(() => controller.abort(), timeout);
  if (!(typeof timer === 'number' || typeof timer === 'string')) {
    timer.unref();
  }
  controller.signal.onabort = (): void => { timer && stop(timer); };
}

export function parseBody<T>(src: string | undefined): T {
  if (!src) {
    return undefined!;
  }
  try {
    return JSON.parse(src, (key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z/.test(value)) {
        return new Date(value);
      } else {
        return value;
      }
    });
  } catch (err) {
    throw new Error(`Unable to parse response: ${src}, Unknown error: ${err}`);
  }
}

export async function getError(payload: unknown): Promise<Error> {
  try { // server-only
    let res = undefined; // server-only
    const { AppError } = await import('@travetto/runtime'); // server-only
    res = AppError.fromJSON(payload); // server-only
    if (res) { // server-only
      return res; // server-only
    } // server-only
  } catch { } // server-only
  if (payload instanceof Error) {
    return payload;
  } else {
    const err = new Error();
    Object.assign(err, payload);
    return err;
  }
}

/**
 * Execute request
 */
export async function makeRequest<T = unknown>(opts: ClientOptions, ...params: unknown[]): Promise<T> {
  /** @type {AbortSignal | undefined} */
  let signal;
  if (opts.timeout) {
    const abort = new AbortController();
    signal = abort.signal;
    registerTimeout(abort, opts.timeout, setTimeout, clearTimeout);
  }
  try {
    const res = await fetch(opts.url, {
      ...opts.request,
      signal,
      body: JSON.stringify(params),
    });

    const payload = res.body ? await res.text() : undefined;
    const body = parseBody<T>(payload);

    if (res.ok) {
      return body;
    } else {
      throw await getError(body);
    }
  } catch (err) {
    throw await getError(err);
  }
}

export function clientFactory<T extends Record<string, {}>>(): ClientFactory<T> {
  // @ts-ignore
  return function (opts, decorate) {
    opts.request ??= { credentials: 'include', mode: 'cors' };
    const cache: Record<string, unknown> = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, controller: string) =>
        cache[controller] ??= new Proxy({}, {
          get: (__, endpoint: string): unknown => {
            const target = `${controller}#${endpoint}`;
            const request = {
              ...opts.request ?? {},
              method: 'POST',
              headers: {
                ...opts.request?.headers ?? {},
                'Content-Type': 'application/json',
                'X-TRV-RPC': target
              }
            };
            return cache[target] ??= Object.defineProperties(
              makeRequest.bind(null, { ...opts, request }),
              Object.fromEntries(
                Object.entries(decorate?.({ ...opts, request }, target) ?? {}).map(([k, v]) => [k, { value: v }])
              )
            );
          }
        })
    });
  };
}

export function IGNORE<T>(): T { return null!; }