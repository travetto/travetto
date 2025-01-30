import { AppError, BinaryUtil, Util } from '@travetto/runtime';
import { Request, Response } from '../types';

type List<T> = T[] | readonly T[];
type OrderedState<T> = { after?: List<T>, before?: List<T>, key: T };
type ValueConfig = { mode?: 'header' | 'cookie', header: string, cookie: string, headerPrefix?: string, signingKey?: string };

export class RestCommonUtil {

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
  static writeValue<T = unknown>(cfg: ValueConfig, res: Response, value: T | undefined, opts?: { expires?: Date }): void {
    let output = Util.encodeSafeJSON<T>(value);

    if (output && cfg.signingKey) {
      output = `${output}#${BinaryUtil.hash(output + cfg.signingKey)}`;
    }

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
  static readValue<T = unknown>(cfg: ValueConfig, req: Request): T | undefined {
    let res = (cfg.mode === 'cookie' || !cfg.mode) ?
      req.cookies.get(cfg.cookie) :
      req.headerFirst(cfg.header);

    if (res && cfg.mode === 'header' && cfg.headerPrefix) {
      res = res.split(cfg.headerPrefix)[1].trim();
    }

    if (res && cfg.signingKey) {
      const parts = res?.split('#');
      if (parts.length < 2) {
        throw new AppError('Missing signature for signed field', { category: 'permissions' });
      }
      if (parts[1] !== BinaryUtil.hash(parts[0] + cfg.signingKey)) {
        throw new AppError('Invalid signature for signed field', { category: 'permissions' });
      }
      res = parts[0];
    }

    return res ? Util.decodeSafeJSON<T>(res) : undefined;
  }
}