type MethodConfig = { body: boolean, standard: boolean, emptyStatusCode: number };
function VERB<M extends string, L extends string, C extends Partial<MethodConfig>>(method: M, lower: L, cfg: C): { method: M, lower: L } & C & MethodConfig {
  return { body: false, emptyStatusCode: 204, standard: true, method, lower, ...cfg };
}

export const HTTP_METHODS = {
  PUT: VERB('PUT', 'put', { body: true }),
  POST: VERB('POST', 'post', { body: true, emptyStatusCode: 201 }),
  PATCH: VERB('PATCH', 'patch', { body: true }),
  GET: VERB('GET', 'get', {}),
  DELETE: VERB('DELETE', 'delete', {}),
  HEAD: VERB('HEAD', 'head', {}),
  OPTIONS: VERB('OPTIONS', 'options', {}),
  ALL: VERB('ALL', 'all', { standard: false }),
} as const;
type HttpMethodsType = typeof HTTP_METHODS;

export type HttpMethodWithAll = keyof HttpMethodsType;
export type HttpMethod = { [K in keyof HttpMethodsType]: HttpMethodsType[K]['standard'] extends false ? never : K }[HttpMethodWithAll];
export type HttpProtocol = 'http' | 'https';
export type HttpMetadataConfig = { mode: 'cookie' | 'header', headerPrefix?: string, header: string, cookie: string };

/**
 * High level categories with a defined ordering
 */
export const HTTP_INTERCEPTOR_CATEGORIES = ['global', 'terminal', 'request', 'response', 'application', 'value', 'unbound'] as const;

/**
 * High level categories with a defined ordering
 */
export type HttpInterceptorCategory = (typeof HTTP_INTERCEPTOR_CATEGORIES)[number];
