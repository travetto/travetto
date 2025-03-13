import type { GetOption, SetOption } from 'cookies';
import type { HttpRequest, HttpResponse } from '../types.ts';

type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };
type ValueConfig = { mode?: 'header' | 'cookie', header: string, cookie: string, headerPrefix?: string };

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
  static writeValue(cfg: ValueConfig, res: HttpResponse, output: string | undefined, opts?: SetOption): void {
    if (cfg.mode === 'cookie' || !cfg.mode) {
      res.cookies.set(cfg.cookie, output, {
        ...opts,
        maxAge: (output !== undefined) ? undefined : -1,
      });
    }
    if (cfg.mode === 'header') {
      if (output) {
        res.setHeader(cfg.header, cfg.headerPrefix ? `${cfg.headerPrefix} ${output}` : output);
      } else {
        res.removeHeader(cfg.header);
      }
    }
  }

  /**
   * Read value from request
   */
  static readValue(cfg: ValueConfig, req: HttpRequest, opts?: GetOption): string | undefined {
    let res = (cfg.mode === 'cookie' || !cfg.mode) ?
      req.cookies.get(cfg.cookie, opts) :
      req.headerFirst(cfg.header);

    if (res && cfg.mode === 'header' && cfg.headerPrefix) {
      res = res.split(cfg.headerPrefix)[1].trim();
    }

    return res;
  }
}