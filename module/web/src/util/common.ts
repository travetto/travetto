import { RuntimeError, type ErrorCategory, Util } from '@travetto/runtime';

import { WebResponse } from '../types/response.ts';
import type { WebRequest } from '../types/request.ts';
import type { WebError } from '../types/error.ts';

type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };

const WebRequestParamsSymbol = Symbol();

export type ByteSizeInput = `${number}${'mb' | 'kb' | 'gb' | 'b' | ''}` | number;

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

const UNIT_MAPPING: Record<string, number> = {
  kb: 2 ** 10,
  mb: 2 ** 20,
  gb: 2 ** 30,
};

export class WebCommonUtil {
  static #convert(rule: string): RegExp {
    const core = (rule.endsWith('/*') || !rule.includes('/')) ?
      `${rule.replace(/[/].{0,20}$/, '')}\/.*` : rule;
    return new RegExp(`^${core}[ ]{0,10}(;|$)`);
  }

  static #buildEdgeMap<T, U extends OrderedState<T>>(items: List<U>): Map<T, Set<T>> {
    const edgeMap = new Map(items.map(item => [item.key, new Set(item.after ?? [])]));

    // Build out edge map
    for (const input of items) {
      for (const item of input.before ?? []) {
        if (edgeMap.has(item)) {
          edgeMap.get(item)!.add(input.key);
        }
      }
      const afterSet = edgeMap.get(input.key)!;
      for (const item of input.after ?? []) {
        afterSet.add(item);
      }
    }
    return edgeMap;
  }

  /**
   * Build matcher
   */
  static mimeTypeMatcher(rules: string[] | string = []): (contentType: string) => boolean {
    return Util.allowDeny<RegExp, [string]>(
      rules,
      this.#convert.bind(this),
      (regex, mime) => regex.test(mime),
      key => key
    );
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

    const inputMap = new Map(items.map(item => [item.key, item]));
    return keys.map(key => inputMap.get(key)!);
  }

  /**
   * Get status code
   */
  static getStatusCode(response: WebResponse): number {
    return (response.headers.has('Content-Range') && response.context.httpStatusCode === 200) ?
      206 :
      response.context.httpStatusCode ?? 200;
  }

  /**
   * From catch value
   */
  static catchResponse(error: unknown): WebResponse<Error> {
    if (error instanceof WebResponse) {
      return error;
    }

    const body = error instanceof Error ? error :
      (!!error && typeof error === 'object' && ('message' in error && typeof error.message === 'string')) ?
        new RuntimeError(error.message, { details: error }) :
        new RuntimeError(`${error}`);

    const webError: Error & Partial<WebError> = body;
    const statusCode = webError.details?.statusCode ?? ERROR_CATEGORY_STATUS[webError.category!] ?? 500;

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

  /**
   * Parse byte size
   */
  static parseByteSize(input: ByteSizeInput): number {
    if (typeof input === 'number') {
      return input;
    }
    const [, value, unit] = input.toLowerCase().split(/(\d+)/);
    return parseInt(value, 10) * (UNIT_MAPPING[unit] ?? 1);
  }
}