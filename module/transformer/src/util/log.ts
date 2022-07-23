import { Util } from '@travetto/base';

const exclude = new Set([
  'parent', 'checker', 'end', 'pos', 'id', 'source', 'sourceFile', 'getSourceFile',
  'statements', 'stringIndexInfo', 'numberIndexInfo', 'instantiations', 'thisType',
  'members', 'properties', 'outerTypeParameters', 'exports', 'transformFlags', 'flowNode',
  'nextContainer', 'modifierFlagsCache', 'declaredProperties'
]);

/**
 * Utilities for logging typescript nodes
 */
export class LogUtil {
  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNodes(all: unknown[]): unknown[] {
    return all.map(x => this.collapseNode(x));
  }

  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNode(x: unknown, cache: Set<unknown> = new Set()): unknown {
    if (!x || Util.isPrimitive(x)) {
      return x;
    }

    if (cache.has(x)) {
      return;
    } else {
      cache.add(x);
    }

    if (Array.isArray(x)) {
      return x.map(v => this.collapseNode(v, cache));
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const ox = x as object;
      const out: Record<string, unknown> = {};
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      for (const key of Object.keys(ox) as (keyof typeof x)[]) {
        if (Util.isFunction(ox[key]) || exclude.has(key) || ox[key] === undefined) {
          continue;
        }
        try {
          out[key] = this.collapseNode(ox[key], cache);
        } catch {
          return undefined;
        }
      }
      return out;
    }
  }
}