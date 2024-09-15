type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];

type ClientRequest = Partial<Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }>;

export type ClientOptions = {
  url: string;
  timeout: number;
  request: ClientRequest;
  makeRequest: (opts: ClientOptions, ...args: unknown[]) => Promise<unknown>;
  parseBody: <T>(val: string | undefined) => Promise<T>;
  toError: (err: unknown) => (Promise<Error> | Error);
};

export type Client<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type ClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    baseOpts: Partial<ClientOptions> & { url: string },
    decorate?: (opts: ClientOptions) => R
  ) => Client<T, R>;


export async function toError(payload: unknown): Promise<Error> {
  if (payload instanceof Error) {
    return payload;
  } else {
    const err = new Error();
    Object.assign(err, payload);
    return err;
  }
}

export function buildRequest(base: ClientRequest, controller: string, endpoint: string): ClientRequest {
  return {
    ...base,
    method: 'POST',
    headers: {
      ...base.headers,
      'Content-Type': 'application/json',
      'X-TRV-RPC': `${controller}#${endpoint}`
    }
  };
}

export function registerTimeout<T extends (number | string | { unref(): unknown })>(
  timeout: number | undefined,
  start: (fn: (...args: unknown[]) => unknown, delay: number) => T,
  stop: (val: T) => void
): AbortSignal | undefined {
  if (!timeout) {
    return;
  }
  const controller = new AbortController();
  const timer = start(() => controller.abort(), timeout);
  if (!(typeof timer === 'number' || typeof timer === 'string')) {
    timer.unref();
  }
  controller.signal.onabort = (): void => { timer && stop(timer); };
  return controller.signal;
}

export async function parseBody<T>(src: string | undefined): Promise<T> {
  if (src === null || src === undefined || src === '') {
    return undefined!;
  }
  try {
    return JSON.parse(src, (key, value): unknown => {
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

/**
 * Simple fetch request
 */
export async function makeRequest<T = unknown>(opts: ClientOptions, ...params: unknown[]): Promise<T> {
  try {
    const res = await fetch(opts.url, {
      ...opts.request,
      signal: registerTimeout(opts.timeout, setTimeout, clearTimeout),
      body: JSON.stringify(params),
    });

    const payload = res.body ? await res.text() : undefined;
    const body = await opts.parseBody<T>(payload);

    if (res.ok) {
      return body!;
    } else {
      throw await opts.toError(body);
    }
  } catch (err) {
    throw await opts.toError(err);
  }
}

export function clientFactory<T extends Record<string, {}>>(): ClientFactory<T> {
  // @ts-ignore
  return function (opts, decorate) {
    const base: ClientOptions = {
      timeout: 0, makeRequest, parseBody, toError,
      ...opts,
      request: { credentials: 'include', mode: 'cors', ...opts.request },
    };
    const cache: Record<string, unknown> = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, controller: string) =>
        cache[controller] ??= new Proxy({}, {
          get: (__, endpoint: string): unknown => {
            const final = { ...base, request: buildRequest(base.request, controller, endpoint) };
            return cache[`${controller}/${endpoint}`] ??= Object.defineProperties(
              base.makeRequest.bind(null, final),
              Object.fromEntries(
                Object.entries(decorate?.(final) ?? {}).map(([k, v]) => [k, { value: v }])
              )
            );
          }
        })
    });
  };
}

export function IGNORE<T>(): T { return null!; }