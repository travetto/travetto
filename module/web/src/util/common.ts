import { HttpMetadataConfig } from '../types/core';
import { Cookie, CookieGetOptions } from '../types/cookie';
import { WebRequest } from '../types/request';
import { WebResponse } from '../types/response';

type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };

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
   * Write value to response
   */
  static writeMetadata(res: WebResponse, cfg: HttpMetadataConfig, value: string | undefined, opts?: Omit<Cookie, 'name' | 'value'>): WebResponse {
    if (cfg.mode === 'cookie' || !cfg.mode) {
      res.setCookie({
        ...opts,
        name: cfg.cookie, value, maxAge: (value !== undefined) ? opts?.maxAge : -1,
      });
    }
    if (cfg.mode === 'header') {
      if (value) {
        res.headers.set(cfg.header, `${cfg.headerPrefix || ''} ${value}`.trim());
      } else {
        res.headers.delete(cfg.header);
      }
    }
    return res;
  }

  /**
   * Read value from request
   */
  static readMetadata(req: WebRequest, cfg: HttpMetadataConfig, opts?: CookieGetOptions): string | undefined {
    let value = (cfg.mode === 'cookie' || !cfg.mode) ?
      req.getCookie(cfg.cookie, opts) :
      req.headers.get(cfg.header) ?? undefined;

    if (value && cfg.mode === 'header' && cfg.headerPrefix) {
      value = value.split(cfg.headerPrefix)[1].trim();
    }

    return value;
  }
}