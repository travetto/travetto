// @ts-check

/**
 * @template {(number | string | { unref(): unknown })} T
 * @param  controller
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

/** @type {import('./rest-rpc.d.ts').RpcRequestUtil} */
export const RpcRequestUtil = {
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

  /** @template T */
  async exec(opts, ...params) {
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
    const cache = {};
    // @ts-ignore
    return new Proxy({}, {
      get: (_, /** @type {string} */controller) =>
        cache[controller] ??= new Proxy({}, {
          get: (__, /** @type {string} */ endpoint) => {
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
              RpcRequestUtil.exec.bind(RpcRequestUtil, { ...opts, request }),
              Object.fromEntries(
                Object.entries(decorate?.({ ...opts, request }, target) ?? {}).map(([k, v]) => [k, { value: v }])
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
// eslint-disable-next-line @typescript-eslint/naming-convention
export function RPC_IGNORE() {
  /** @type {T} */
  // @ts-ignore
  const res = null;
  return res;
}