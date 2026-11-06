type PromFunc<T, U> = (item: T) => U | Promise<U>;
interface CombinedIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T> | NodeJS.AsyncIterator<T>;
}

declare global {
  // Applies to everything as its simpler.  The type contract will prevent usage if not
  // an iterable.  Once TC39 gets the async iterators into the language, this will go away
  interface Object {
    $map<T, U>(this: CombinedIterable<T>, fn: PromFunc<T, U>): CombinedIterable<U>;
    $filter<T>(this: CombinedIterable<T>, fn: PromFunc<T, boolean>): CombinedIterable<T>;
    $toArray<T>(this: CombinedIterable<T>): Promise<T[]>;
    $flatMap<T, U>(this: CombinedIterable<T>, fn: PromFunc<T, U[]>): CombinedIterable<U>;
    $forEach<T>(this: CombinedIterable<T>, fn: PromFunc<T, unknown>): Promise<void>;
  }
}
