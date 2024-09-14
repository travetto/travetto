// @ts-check

/**
 * @typedef BasicResponse
 * @type {{ text(): (string | Promise<string>), ok: boolean, body?: unknown, statusText?: string, status?: number }}
 */

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

/**
 * @template T
 * @param {BasicResponse} res
 * @returns {Promise<T | undefined>}
 */
export async function getBody(res) {
  const payload = res.body ? await res.text() : undefined;
  try {
    if (payload) {
      const body = JSON.parse(payload, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z/.test(value)) {
          return new Date(value);
        } else {
          return value;
        }
      });
      return body;
    }
  } catch (err) {
    if (res.ok) {
      throw new Error(`Unable to parse response: ${payload}`);
    }
  }
}

/**
 * @param {*} payload
 * @returns {Promise<Error>}
 */
export async function getError(payload) {
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
 * @template T
 * @param {BasicResponse} res
 * @returns {Promise<T>}
 */
export async function onResponse(res) {
  const payload = await getBody(res);
  if (res.ok) {
    return payload;
  } else if (typeof payload === 'object') {
    throw await getError(payload);
  } else {
    throw new Error(payload ?? `Unknown error: ${res.statusText}@${res.status}`);
  }
}

/**
 * Execute request
 * @template T
 * @param {import('./rest-rpc.d.ts').ClientOptions} opts
 * @param  {...unknown} params
 * @returns {Promise<T>}
 */
export async function callRpc(opts, ...params) {
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
    return await onResponse(res);
  } catch (err) {
    throw await getError(err);
  }
}

/** @template {Record<string, {}>} T */
export function clientFactory() {
  /** @type {import('./rest-rpc.d.ts').ClientFactory<T>} */
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
              callRpc.bind(callRpc, { ...opts, request }),
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
export function IGNORE() {
  return /** @type {T} */ (/** @type {T | null} */ null);
}