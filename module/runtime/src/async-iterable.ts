// Apply stream operators to the Object prototype, will remove once
// TC39 gets AsyncIterator helpers into the language
Object.defineProperties(Object.prototype, {
  $map: {
    value: async function* (transform: Function) {
      for await (const item of this) yield await transform(item);
    }
  },
  $filter: {
    value: async function* (predicate: Function) {
      for await (const item of this) {
        if (await predicate(item)) yield item;
      }
    }
  },
  $toArray: {
    value: async function () {
      const out = [];
      for await (const item of this) out.push(item);
      return out;
    }
  },
  $forEach: {
    value: async function (visit: Function) {
      for await (const item of this) await visit(item);
    }
  },
  $flatMap: {
    value: async function* (transform: Function) {
      for await (const item of this) yield* await transform(item);
    }
  }
});

export {};
