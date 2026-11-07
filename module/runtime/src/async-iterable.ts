export interface AsyncIterableOperators<T = unknown> {
  $map<U>(transform: (item: T) => U): AsyncIterable<U>;
  $filter(predicate: (item: T) => boolean | Promise<boolean>): AsyncIterable<T>;
  $forEach(visit: (item: T) => Promise<unknown> | unknown): Promise<void>;
  $onError(onError: (error: unknown) => Promise<unknown> | unknown): AsyncIterable<Exclude<T, undefined>>;
  $flatMap<U>(transform: (input: T) => U[] | Promise<U[]>): AsyncIterable<U>;
  $toArray(): Promise<T[]>;
}

// Apply stream operators to the Object prototype, will remove once
// TC39 gets AsyncIterator helpers into the language
try {
  Object.defineProperties(Object.prototype, {
    $map: {
      value: async function* (transform: Function) {
        for await (const item of this) yield await transform(item);
      }
    },
    $filter: {
      value: async function* (predicate: Function) {
        for await (const item of this) if (await predicate(item)) yield item;
      }
    },
    $onError: {
      value: async function* (handler: Function) {
        for await (const item of this) {
          try {
            yield item;
          } catch (error) {
            handler(error);
          }
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
} catch {}
