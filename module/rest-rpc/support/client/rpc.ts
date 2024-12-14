type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

export type PreRequestHandler = (item: RequestInit) => Promise<RequestInit | undefined | void>;
export type PostResponseHandler = (item: Response) => Promise<Response | undefined | void>;

export type RpcRequest = {
  core?: Partial<RequestInit> & {
    timeout?: number;
    retriesOnConnectFailure?: number;
  };
  url: URL | string;
  consumeJSON?: <T>(text?: unknown) => (T | Promise<T>);
  consumeError?: (item: unknown) => (Error | Promise<Error>);
  preRequestHandlers?: PreRequestHandler[];
  postResponseHandlers?: PostResponseHandler[];
};

export type RpcClient<T extends Record<string, {}>, E extends Record<string, Function> = {}> = {
  [C in keyof T]: Pick<T[C], MethodKeys<T[C]>> & Record<MethodKeys<T[C]>, E>
};

export type RpcClientFactory<T extends Record<string, {}>> =
  <R extends Record<string, Function>>(
    baseOpts: RpcRequest,
    decorate?: (opts: RpcRequest) => R
  ) => RpcClient<T, R>;

function isResponse(v: unknown): v is Response {
  return !!v && typeof v === 'object' && 'status' in v && !!v.status && 'headers' in v && !!v.headers;
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' // separate from primitives
    && obj !== undefined
    && obj !== null         // is obvious
    && obj.constructor === Object // separate instances (Array, DOM, ...)
    && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
}

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

function buildRequest<T extends RequestInit>(base: T, controller: string, endpoint: string): T {
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

export function getBody(inputs: unknown[]): { body: Blob | string, headers: Record<string, string> } {
  // If we have a blob, upload
  if (!inputs.some(x => x instanceof Blob)) {
    return {
      body: JSON.stringify(inputs),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  const plainInputs = inputs.map(x => x instanceof Blob ? null : x);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const blob: Blob = inputs.find(x => x instanceof Blob)! as Blob;

  return {
    body: blob,
    headers: blob instanceof File ? {
      'Content-Disposition': `inline; filename="${blob.name}"`,
      'Content-Type': blob.type ?? 'binary/octet-stream',
      'X-TRV-RPC-INPUTS': btoa(encodeURIComponent(JSON.stringify(plainInputs)))
    } : {}
  };
}


export function consumeJSON<T>(text: string | unknown): T {
  if (typeof text !== 'string') {
    return consumeJSON(JSON.stringify(text));
  } else if (text === null || text === undefined || text === '') {
    return undefined!;
  }
  try {
    return JSON.parse(text, (key, value): unknown => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z/.test(value)) {
        return new Date(value);
      } else {
        return value;
      }
    });
  } catch (err) {
    throw new Error(`Unable to parse response: ${text}, Unknown error: ${err}`);
  }
}

export async function consumeError(err: unknown): Promise<Error> {
  if (err instanceof Error) {
    return err;
  } else if (isResponse(err)) {
    const out = new Error(err.statusText);
    Object.assign(out, { status: err.status });
    return consumeError(out);
  } else if (isPlainObject(err)) {
    const out = new Error();
    Object.assign(out, err);
    return consumeError(out);
  } else {
    return new Error('Unknown error');
  }
}

export async function invokeFetch<T>(req: RpcRequest, ...params: unknown[]): Promise<T> {
  let core = req.core!;

  try {
    const { body, headers } = getBody(params);
    core.body = body;
    core.headers = {
      ...core.headers ?? {},
      ...headers
    };

    for (const fn of req.preRequestHandlers ?? []) {
      const computed = await fn(core);
      if (computed) {
        core = computed;
      }
    }

    const signals = [];
    if (core.signal) {
      signals.push(core.signal);
    }

    if (core.timeout) {
      const controller = new AbortController();
      // Node/Browser handling of timeout registration
      registerTimeout(controller, core.timeout, setTimeout, clearTimeout);
      signals.push(controller.signal)
    }

    if (signals.length) {
      core.signal = AbortSignal.any(signals);
    }

    let resolved: Response | undefined;
    for (let i = 0; i <= (core.retriesOnConnectFailure ?? 0); i += 1) {
      try {
        resolved = await fetch(req.url, core);
        break;
      } catch (err) {
        if (i < (core.retriesOnConnectFailure ?? 0)) {
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!resolved) {
      throw new Error('Unable to connect');
    }

    for (const fn of req.postResponseHandlers ?? []) {
      const computed = await fn(resolved);
      if (computed) {
        resolved = computed;
      }
    }

    const contentType = resolved.headers.get('content-type')?.split(';')[0];

    if (resolved.ok) {
      const text = await resolved.text();
      if (contentType === 'application/json') {
        return await req.consumeJSON!<T>(text);
      } else if (contentType === 'text/plain') {
        return await req.consumeJSON!<T>(text);
      } else {
        throw new Error(`Unknown content type: ${contentType}`);
      }
    } else {
      let res;
      if (contentType === 'application/json') {
        const text = await resolved.text();
        res = await req.consumeJSON!(text);
      } else {
        res = resolved;
      }
      throw res;
    }
  } catch (err) {
    throw await req.consumeError!(err);
  }
}

export function clientFactory<T extends Record<string, {}>>(): RpcClientFactory<T> {
  // @ts-ignore
  return function (opts, decorate) {
    const client: RpcRequest = {
      consumeJSON,
      consumeError,
      ...opts,
      core: { timeout: 0, credentials: 'include', mode: 'cors', ...opts.core },
    };
    const cache: Record<string, unknown> = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, controller: string) =>
        cache[controller] ??= new Proxy({}, {
          get: (__, endpoint: string): unknown => {
            const final: RpcRequest = {
              ...client,
              core: buildRequest(client.core!, controller, endpoint)
            };
            return cache[`${controller}/${endpoint}`] ??= Object.defineProperties(
              invokeFetch.bind(null, final),
              Object.fromEntries(
                Object.entries(decorate?.(final) ?? {}).map(([k, v]) => [k, { value: v }])
              )
            );
          }
        })
    });
  };
}

export function withConfigFactoryDecorator(opts: RpcRequest) {
  return {
    withConfig<V extends PromiseFn>(this: V, extra: Partial<RpcRequest['core']>, ...params: Parameters<V>): Promise<PromiseRes<V>> {
      return invokeFetch({ ...opts, core: { ...opts.core, ...extra } }, ...params);
    }
  };
}

export function IGNORE<T>(): T { return null!; }