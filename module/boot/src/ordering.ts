export type Orderable<T> = {
  after?: T[];
  before?: T[];
  key: T;
};

/**
 * Ordering utilities
 */
export class OrderingUtil {

  /**
   * Produces a satisfied ordering for a list of orderable elements
   */
  static compute<T,
    U extends Orderable<T>,
    V extends {
      after: Set<T>;
      key: T;
      target: U;
    }
  >(items: U[]): U[] {

    // Turn items into a map by .key value, pointing to a mapping of type V
    const allMap = new Map<T, V>(items.map((x: U): [T, V] => [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      x.key, {
        key: x.key,
        target: x,
        after: new Set(x.after || [])
      } as V
    ]));

    const all = new Set<V>(allMap.values());

    // Loop through all new items of type V, converting before into after
    for (const item of all) {
      const before = item.target.before || [];
      for (const bf of before) {
        if (allMap.has(bf)) {
          allMap.get(bf)!.after.add(item.key);
        }
      }
      item.after = new Set(Array.from(item.after).filter(x => allMap.has(x)));
    }

    // Loop through all items again
    const out: U[] = [];
    while (all.size > 0) {

      // Find node with no dependencies
      const next = [...all].find(x => x.after.size === 0);
      if (!next) {
        throw new Error(`Unsatisfiable dependency: ${[...all].map(x => x.target)}`);
      }

      // Store, and remove
      out.push(next.target);
      all.delete(next);

      // Remove node from all other elements in `all`
      for (const rem of all) {
        rem.after.delete(next.key);
      }
    }

    return out;
  }
}