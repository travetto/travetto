const exclude = new Set([
  'parent', 'checker', 'end', 'pos', 'id', 'source', 'sourceFile', 'getSourceFile',
  'statements', 'stringIndexInfo', 'numberIndexInfo', 'instantiations', 'thisType',
  'members', 'properties', 'outerTypeParameters', 'exports', 'transformFlags', 'flowNode',
  'nextContainer', 'modifierFlagsCache', 'declaredProperties'
]);

const TypedObject: { keys<T = unknown, K extends keyof T = keyof T>(o: T): K[] } & ObjectConstructor = Object;

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
    if (!x || !(typeof x === 'object' || typeof x === 'function')) {
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
      const ox = x;
      const out: Record<string, unknown> = {};
      for (const key of TypedObject.keys(ox)) {
        if (Object.getPrototypeOf(ox[key]) === Function.prototype || exclude.has(key) || ox[key] === undefined) {
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