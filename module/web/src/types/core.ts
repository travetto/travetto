type MethodConfig = { body: boolean, emptyStatusCode: number, cacheable: boolean };
function verb<
  M extends string,
  L extends string,
  C extends Partial<MethodConfig>
>(method: M, lower: L, cfg: C): { method: M, lower: L } & C & MethodConfig {
  return { body: false, cacheable: false, emptyStatusCode: 204, ...cfg, method, lower, };
}

export const HTTP_METHODS = {
  PUT: verb('PUT', 'put', { body: true }),
  POST: verb('POST', 'post', { body: true, emptyStatusCode: 201 }),
  PATCH: verb('PATCH', 'patch', { body: true }),
  GET: verb('GET', 'get', { cacheable: true }),
  DELETE: verb('DELETE', 'delete', {}),
  HEAD: verb('HEAD', 'head', { cacheable: true }),
  OPTIONS: verb('OPTIONS', 'options', {}),
} as const;

export type HttpMethod = keyof typeof HTTP_METHODS;
export type HttpProtocol = 'http' | 'https';

/**
 * High level categories with a defined ordering
 */
export const WEB_INTERCEPTOR_CATEGORIES = [
  'global', 'terminal', 'pre-request', 'request', 'response', 'application'
] as const;

/**
 * High level categories with a defined ordering
 */
export type WebInterceptorCategory = (typeof WEB_INTERCEPTOR_CATEGORIES)[number];