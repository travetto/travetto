const exclude = new Set([
  'parent', 'checker', 'end', 'pos', 'id', 'source', 'sourceFile', 'getSourceFile',
  'statements', 'stringIndexInfo', 'numberIndexInfo', 'instantiations', 'thisType',
  'members', 'properties', 'outerTypeParameters', 'exports', 'transformFlags', 'flowNode',
  'nextContainer', 'modifierFlagsCache', 'declaredProperties'
]);

const TypedObject: { keys<T = unknown, K extends keyof T = keyof T>(value: T): K[] } & ObjectConstructor = Object;

/**
 * Utilities for logging typescript nodes
 */
export class LogUtil {
  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNodes(all: unknown[]): unknown[] {
    return all.map(value => this.collapseNode(value));
  }

  /**
   * Clean up `ts.Node` contents for logging
   */
  static collapseNode(value: unknown, cache: Set<unknown> = new Set()): unknown {
    if (!value || !(typeof value === 'object' || typeof value === 'function')) {
      return value;
    }

    if (cache.has(value)) {
      return;
    } else {
      cache.add(value);
    }

    if (Array.isArray(value)) {
      return value.map(node => this.collapseNode(node, cache));
    } else {
      const ox = value;
      const out: Record<string, unknown> = {};
      for (const key of TypedObject.keys(ox)) {
        if (ox[key] === null || ox[key] === undefined || Object.getPrototypeOf(ox[key]) === Function.prototype || exclude.has(key)) {
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