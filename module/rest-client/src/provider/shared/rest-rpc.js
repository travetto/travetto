// @ts-check

/**
 * Node/Browser handling of timeout registration
 * @template {(number | string | { unref(): unknown })} T
 * @param {AbortController} controller 
 * @param {number} timeout 
 * @param {(fn: (...args: unknown[]) => unknown, delay: number) => T} start 
 * @param {(val: T) => void} stop 
 */
function registerTimeout(controller, timeout, start, stop) {
  const timer = start(() => controller.abort(), timeout);
  if (!(typeof timer === 'number' || typeof timer === 'string')) {
    timer.unref();
  }
  controller.signal.onabort = () => { timer && stop(timer); };
}

/**
 * @template T
 * @param {import('./rest-rpc.d.ts').RestRpcClientOptions} opts 
 * @param {string} controller
 * @param {string} method
 */
function fetcher(opts, controller, method) {
  /** @type {AbortSignal | undefined} */
  let signal;

  if (opts.timeout) {
    const abort = new AbortController();
    signal = abort.signal;
    registerTimeout(abort, opts.timeout, setTimeout, clearTimeout);
  }

  /** 
   * @param {unknown[]} params 
   * @returns {Promise<T>}
   */
  return (...params) => fetch(opts.url, {
    ...opts.request,
    signal,
    body: JSON.stringify({ params, method, controller }),
  })
    .then(async res => {
      let payload = res.body ? await res.text() : undefined;
      try {
        if (payload) {
          payload = JSON.parse(payload);
        }
      } catch (err) {
        if (res.ok) {
          throw new Error(`Unable to parse response: ${payload}`);
        }
      }
      if (res.ok) {
        /** @type {T} */
        // @ts-ignore
        const res = payload;
        return res;
      } else if (typeof payload === 'object') {
        try {
          // @ts-ignore
          const { AppError } = await import('@travetto/base');
          if (AppError.isErrorLike(payload)) {
            throw AppError.fromErrorLike(payload);
          }
        } catch { }
        const err = new Error();
        Object.assign(err, payload);
        throw err;
      } else {
        throw new Error(payload ?? `Unknown error: ${res.statusText}@${res.status}`);
      }
    });
}

/** 
 * @template {Record<string, {}>} T
 */
export function restRpcClientFactory() {
  /** @type {import('./rest-rpc.d.ts').RestRpcClientFactory<T>} */
  return function (opts, decorate) {
    const headers = new Headers(opts.request?.headers ?? {});

    opts.request = {
      ...opts.request ??= {},
      method: 'POST',
      headers: {
        ...Object.fromEntries(headers.entries()),
        'X-RPC': '1',
        'Content-Type': 'application/json'
      }
    };

    const d = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, /** @type {string} */c) =>
        d[c] ??= new Proxy({}, {
          get: (__, /** @type {string} */ m) => d[`${c}.${m}`] ??= Object.defineProperties(
            fetcher(opts, c, m),
            Object.fromEntries(
              Object.entries(decorate?.(opts, c, m) ?? {}).map(([k, v]) => [k, { value: v }])
            )
          )
        })
    });
  };
}

/** 
 * @template T
 * @returns {T}
 */
export function RPC_IGNORE() {
  /** @type {T} */
  // @ts-ignore
  const res = null;
  return res;
}