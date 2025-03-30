export const HTTP_METHODS = {
  PUT: { method: 'PUT', body: true, lower: 'put', standard: true },
  POST: { method: 'POST', body: true, lower: 'post', standard: true },
  GET: { method: 'GET', body: false, lower: 'get', standard: true },
  DELETE: { method: 'DELETE', body: false, lower: 'delete', standard: true },
  PATCH: { method: 'PATCH', body: true, lower: 'patch', standard: true },
  HEAD: { method: 'HEAD', body: false, lower: 'head', standard: true },
  OPTIONS: { method: 'OPTIONS', body: false, lower: 'options', standard: true },
  ALL: { method: 'ALL', body: true, lower: 'all', standard: false },
} as const;
type HttpMethodsType = typeof HTTP_METHODS;

export type HttpMethodWithAll = keyof HttpMethodsType;
export type HttpMethod = { [K in keyof HttpMethodsType]: HttpMethodsType[K]['standard'] extends true ? K : never }[HttpMethodWithAll];
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
