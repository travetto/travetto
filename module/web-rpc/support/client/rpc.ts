type MethodKeys<C extends {}> = {
  [METHOD in keyof C]: C[METHOD] extends Function ? METHOD : never
}[keyof C];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseFn = (...args: any) => Promise<unknown>;
type PromiseRes<V extends PromiseFn> = Awaited<ReturnType<V>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBlobMap = (value: any): value is Record<string, Blob> => value && typeof value === 'object' && value[Object.keys(value)[0]] instanceof Blob;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBlobLike = (value: any): value is Record<string, Blob> | Blob => value instanceof Blob || isBlobMap(value);

const extendHeaders = (base: RequestInit['headers'], toAdd: Record<string, string>): Headers => {
  const headers = new Headers(base);
  for (const [key, value] of Object.entries(toAdd)) { headers.set(key, value); }
  return headers;
};

const jsonToString = (input: unknown): string =>
  JSON.stringify(input, (key, value): unknown => typeof value === 'bigint' ? `${value.toString()}n` : value);

const stringToJson = <T = unknown>(input: string): T =>
  JSON.parse(input, (key, value): unknown => {
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z$/.test(value)) {
        return new Date(value);
      } else if (/^-?d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
    }
    return value;
  });


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

function isResponse(value: unknown): value is Response {
  return !!value && typeof value === 'object' && 'status' in value && !!value.status && 'headers' in value && !!value.headers;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' // separate from primitives
    && value !== undefined
    && value !== null         // is obvious
    && value.constructor === Object // separate instances (Array, DOM, ...)
    && Object.prototype.toString.call(value) === '[object Object]'; // separate build-in like Math
}

function registerTimeout<T>(
  controller: AbortController,
  timeout: number,
  start: (fn: (...args: unknown[]) => unknown, delay: number) => T,
  stop: (value: T) => void
): void {
  const timer = start(() => controller.abort(), timeout);
  if (timer && typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') {
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
        'X-TRV-RPC-INPUTS': btoa(encodeURIComponent(jsonToString(inputs)))
      }
    };
  }
  // If we do not have a blob, simple output
  if (!inputs.some(isBlobLike)) {
    return {
      body: jsonToString(inputs),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  const plainInputs = inputs.map(value => isBlobLike(value) ? null : value);
  const form = new FormData();

  for (const input of inputs.filter(isBlobLike)) {
    if (input instanceof Blob) {
      form.append('file', input, (input instanceof File) ? input.name : undefined);
    } else {
      for (const [name, blob] of Object.entries(input)) {
        form.append(name, blob, (blob instanceof File) ? blob.name : undefined);
      }
    }
  }

  return {
    body: form,
    headers: {
      'X-TRV-RPC-INPUTS': btoa(encodeURIComponent(jsonToString(plainInputs)))
    }
  };
}

export function consumeJSON<T>(input: string | unknown): T {
  let text: string;
  if (input === null || input === undefined || input === '') {
    return undefined!;
  } else if (typeof input !== 'string') {
    text = jsonToString(input);
  } else {
    text = input;
  }
  try {
    return stringToJson<T>(text);
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
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
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
                Object.entries(decorate?.(final) ?? {}).map(([key, value]) => [key, { value }])
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