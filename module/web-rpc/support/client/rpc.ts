type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBlobMap = (x: any): x is Record<string, Blob> => x && typeof x === 'object' && x[Object.keys(x)[0]] instanceof Blob;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBlobLike = (x: any): x is Record<string, Blob> | Blob => x instanceof Blob || isBlobMap(x);

const extendHeaders = (base: RequestInit['headers'], toAdd: Record<string, string>): Headers => {
  const headers = new Headers(base);
  for (const [k, v] of Object.entries(toAdd)) { headers.set(k, v); }
  return headers;
};

export type PreRequestHandler = (item: RequestInit) => Promise<RequestInit | undefined | void>;
export type PostResponseHandler = (item: Response) => Promise<Response | undefined | void>;

export type RpcRequest = {
  core?: Partial<RequestInit> & {
    timeout?: number;
    retriesOnConnectFailure?: number;
    path?: string;
    controller?: string;
    endpoint?: string;
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
    decorate?: (request: RpcRequest) => R
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
  stop: (value: T) => void
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
    path: `${controller}:${endpoint}`,
    controller,
    endpoint
  };
}

export function getBody(inputs: unknown[], isBodyRequest: boolean): { body: FormData | string | undefined, headers: Record<string, string> } {
  if (!isBodyRequest) {
    return {
      body: undefined,
      headers: {
        'X-TRV-RPC-INPUTS': btoa(encodeURIComponent(JSON.stringify(inputs)))
      }
    };
  }
  // If we do not have a blob, simple output
  if (!inputs.some(isBlobLike)) {
    return {
      body: JSON.stringify(inputs),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  const plainInputs = inputs.map(x => isBlobLike(x) ? null : x);
  const form = new FormData();

  for (const inp of inputs.filter(isBlobLike)) {
    if (inp instanceof Blob) {
      form.append('file', inp, (inp instanceof File) ? inp.name : undefined);
    } else {
      for (const [name, blob] of Object.entries(inp)) {
        form.append(name, blob, (blob instanceof File) ? blob.name : undefined);
      }
    }
  }

  return {
    body: form,
    headers: {
      'X-TRV-RPC-INPUTS': btoa(encodeURIComponent(JSON.stringify(plainInputs)))
    }
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
  } catch (error) {
    throw new Error(`Unable to parse response: ${text}, Unknown error: ${error}`);
  }
}

export async function consumeError(error: unknown): Promise<Error> {
  if (error instanceof Error) {
    return error;
  } else if (isResponse(error)) {
    const out = new Error(error.statusText);
    Object.assign(out, { status: error.status });
    return consumeError(out);
  } else if (isPlainObject(error)) {
    const out = new Error();
    Object.assign(out, error);
    return consumeError(out);
  } else {
    return new Error('Unknown error');
  }
}

export async function invokeFetch<T>(request: RpcRequest, ...params: unknown[]): Promise<T> {
  let core = request.core!;

  try {
    const { body, headers } = getBody(params, /^(post|put|patch)$/i.test(request.core?.method ?? 'POST'));
    if (body) {
      core.body = body;
    }
    core.headers = extendHeaders(core.headers, headers);

    for (const fn of request.preRequestHandlers ?? []) {
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
      signals.push(controller.signal);
    }

    if (signals.length) {
      core.signal = AbortSignal.any(signals);
    }

    const url = typeof request.url === 'string' ? new URL(request.url) : request.url;
    if (request.core?.path) {
      url.pathname = `${url.pathname}/${request.core.path}`.replaceAll('//', '/');
    }

    let resolved: Response | undefined;
    for (let i = 0; i <= (core.retriesOnConnectFailure ?? 0); i += 1) {
      try {
        resolved = await fetch(url, core);
        break;
      } catch (error) {
        if (i < (core.retriesOnConnectFailure ?? 0)) {
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s
          continue;
        } else {
          throw error;
        }
      }
    }

    if (!resolved) {
      throw new Error('Unable to connect');
    }

    for (const fn of request.postResponseHandlers ?? []) {
      const computed = await fn(resolved);
      if (computed) {
        resolved = computed;
      }
    }

    const contentType = resolved.headers.get('Content-Type')?.split(';')[0];

    if (resolved.ok) {
      const text = await resolved.text();
      if (contentType === 'application/json') {
        return await request.consumeJSON!<T>(text);
      } else if (contentType === 'text/plain') {
        return await request.consumeJSON!<T>(text);
      } else {
        throw new Error(`Unknown content type: ${contentType}`);
      }
    } else {
      let responseObject;
      if (contentType === 'application/json') {
        const text = await resolved.text();
        responseObject = await request.consumeJSON!(text);
      } else {
        responseObject = resolved;
      }
      throw responseObject;
    }
  } catch (error) {
    throw await request.consumeError!(error);
  }
}

export function clientFactory<T extends Record<string, {}>>(): RpcClientFactory<T> {
  // @ts-ignore
  return function (request, decorate) {
    const client: RpcRequest = {
      consumeJSON,
      consumeError,
      ...request,
      core: { timeout: 0, credentials: 'include', mode: 'cors', ...request.core },
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function withConfigFactoryDecorator(request: RpcRequest) {
  return {
    withConfig<V extends PromiseFn>(this: V, extra: Partial<RpcRequest['core']>, ...params: Parameters<V>): Promise<PromiseRes<V>> {
      return invokeFetch({ ...request, core: { ...request.core, ...extra } }, ...params);
    }
  };
}