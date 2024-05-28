// @ts-check

/** @type {import('./rest-rpc.d.ts').RpcRequestUtil} */
export const RpcRequestUtil = {
  registerTimeout(controller, timeout, start, stop) {
    const timer = start(() => controller.abort(), timeout);
    if (!(typeof timer === 'number' || typeof timer === 'string')) {
      timer.unref();
    }
    controller.signal.onabort = () => { timer && stop(timer); };
  },

  async getBody(res) {
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
    return payload;
  },

  async getError(payload) {
    try {
      // @ts-ignore
      const { AppError } = await import('@travetto/base');
      if (AppError.isErrorLike(payload)) {
        return AppError.fromErrorLike(payload);
      }
    } catch { }
    if (payload instanceof Error) {
      return payload;
    } else {
      const err = new Error();
      Object.assign(err, payload);
      return err;
    }
  },

  getRequestOptions(opts, params) {
    return {
      ...opts.request ?? {},
      method: 'POST',
      headers: {
        ...Object.fromEntries(new Headers(opts.request?.headers ?? {}).entries()),
        'X-RPC': '1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ params, method: opts.method, controller: opts.controller }),
    }
  },

  /** @template T */
  async exec(opts, ...params) {
    /** @type {AbortSignal | undefined} */
    let signal;
    if (opts.timeout) {
      const abort = new AbortController();
      signal = abort.signal;
      RpcRequestUtil.registerTimeout(abort, opts.timeout, setTimeout, clearTimeout);
    }
    try {
      const res = await fetch(opts.url, {
        ...RpcRequestUtil.getRequestOptions(opts, params),
        signal
      });
      const payload = await RpcRequestUtil.getBody(res);
      if (res.ok) {
        // @ts-expect-error
        const /** @type {T} */ final = payload;
        return final;
      } else if (typeof payload === 'object') {
        throw await RpcRequestUtil.getError(payload);
      } else {
        throw new Error(payload ?? `Unknown error: ${res.statusText}@${res.status}`);
      }
    } catch (err) {
      throw await RpcRequestUtil.getError(err);
    }
  }
};

/** @template {Record<string, {}>} T */
export function restRpcClientFactory() {
  /** @type {import('./rest-rpc.d.ts').RestRpcClientFactory<T>} */
  return function (opts, decorate) {
    const d = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, /** @type {string} */c) =>
        d[c] ??= new Proxy({}, {
          get: (__, /** @type {string} */ m) => {
            const dec = { ...opts, controller: c, method: m };
            return d[`${c}.${m}`] ??= Object.defineProperties(
              RpcRequestUtil.exec.bind(RpcRequestUtil, dec),
              Object.fromEntries(
                Object.entries(decorate?.(dec) ?? {}).map(([k, v]) => [k, { value: v }])
              )
            );
          }
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