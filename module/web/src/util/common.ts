import { AppError, ErrorCategory } from '@travetto/runtime';
import { WebResponse } from '../types/response.ts';
import { WebRequest } from '../types/request.ts';

type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };

const WebRequestParamsSymbol = Symbol();

/**
 * Mapping from error category to standard http error codes
 */
const ERROR_CATEGORY_STATUS: Record<ErrorCategory, number> = {
  general: 500,
  notfound: 404,
  data: 400,
  permissions: 403,
  authentication: 401,
  timeout: 408,
  unavailable: 503,
};

export class WebCommonUtil {

  static #buildEdgeMap<T, U extends OrderedState<T>>(items: List<U>): Map<T, Set<T>> {
    const edgeMap = new Map(items.map(x => [x.key, new Set(x.after ?? [])]));

    // Build out edge map
    for (const input of items) {
      for (const bf of input.before ?? []) {
        if (edgeMap.has(bf)) {
          edgeMap.get(bf)!.add(input.key);
        }
      }
      const afterSet = edgeMap.get(input.key)!;
      for (const el of input.after ?? []) {
        afterSet.add(el);
      }
    }
    return edgeMap;
  }

  /**
   * Produces a satisfied ordering for a list of orderable elements
   */
  static ordered<T, U extends OrderedState<T>>(items: List<U>): U[] {
    const edgeMap = this.#buildEdgeMap<T, U>(items);

    // Loop through all items again
    const keys: T[] = [];
    while (edgeMap.size > 0) {

      // Find node with no dependencies
      const key = [...edgeMap].find(([, after]) => after.size === 0)?.[0];
      if (!key) {
        throw new Error(`Unsatisfiable dependency: ${[...edgeMap.keys()]}`);
      }

      // Store, and remove
      keys.push(key);
      edgeMap.delete(key);

      // Remove node from all other elements in `all`
      for (const [, rem] of edgeMap) {
        rem.delete(key);
      }
    }

    const inputMap = new Map(items.map(x => [x.key, x]));
    return keys.map(k => inputMap.get(k)!);
  }

  /**
   * Get status code
   */
  static getStatusCode(res: WebResponse): number {
    return (res.headers.has('Content-Range') && res.context.httpStatusCode === 200) ? 206 : res.context.httpStatusCode ?? 200;
  }

  /**
   * From catch value
   */
  static catchResponse(err: unknown): WebResponse<Error> {
    if (err instanceof WebResponse) {
      return err;
    }

    const body = err instanceof Error ? err :
      (!!err && typeof err === 'object' && ('message' in err && typeof err.message === 'string')) ?
        new AppError(err.message, { details: err }) :
        new AppError(`${err}`);

    const error: Error & { category?: ErrorCategory, status?: number, statusCode?: number } = body;
    const statusCode = error.status ?? error.statusCode ?? ERROR_CATEGORY_STATUS[error.category!] ?? 500;

    return new WebResponse({ body, context: { httpStatusCode: statusCode } });
  }

  /**
   * Get request parameters
   */
  static getRequestParams(request: WebRequest & { [WebRequestParamsSymbol]?: unknown[] }): unknown[] {
    return request[WebRequestParamsSymbol] ?? [];
  }

  /**
   * Set request parameters
   */
  static setRequestParams(request: WebRequest & { [WebRequestParamsSymbol]?: unknown[] }, params: unknown[]): void {
    request[WebRequestParamsSymbol] ??= params;
  }
}