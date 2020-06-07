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
  static collapseNodes(all: any[]) {
    return all.map(x => this.collapseNode(x));
  }

  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNode(x: any, cache: Set<string> = new Set()): any {
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
      const out: Record<string, any> = {};
      for (const key of Object.keys(x)) {
        if (Util.isFunction(x[key]) || exclude.has(key) || x[key] === undefined) {
          continue;
        }
        try {
          out[key] = this.collapseNode(x[key], cache);
        } catch (err) {
          return undefined;
        }
      }
      return out;
    }
  }
}