import timers from 'node:timers/promises';

export type StoppableIterable<T> = { stream: AsyncIterable<T>, stop: () => void };

export type MapFn<T, U> = (val: T, i: number) => U | Promise<U>;

const isIdx = (x: unknown): x is { idx: number } => (x !== undefined && x !== null) && typeof x === 'object' && 'idx' in x;

export class IterableUtil {

  static DELAY = ({ initialDelay = 0, cycleDelay = 0 }: { initialDelay?: number, cycleDelay?: number } = {}) =>
    <T>(x: T, i: number): Promise<T> => timers.setTimeout(i === 0 ? initialDelay : cycleDelay).then(() => x);

  static map<T, U, V, W>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>, fn3: MapFn<V, W>): AsyncIterable<W>;
  static map<T, U, V>(source: AsyncIterable<T>, fn1: MapFn<T, U>, fn2: MapFn<U, V>): AsyncIterable<V>;
  static map<T, U>(source: AsyncIterable<T>, fn: MapFn<T, U>): AsyncIterable<U>;
  static async * map<T>(source: AsyncIterable<T>, ...fns: MapFn<unknown, unknown>[]): AsyncIterable<unknown> {
    let idx = -1;
    for await (const el of source) {
      if (el !== undefined) {
        idx += 1;
        let m = el;
        for (const fn of fns) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          m = (await fn(m, idx)) as typeof m;
        }
        yield m;
      }
    }
  }

  static async * filter<T>(source: AsyncIterable<T>, pred: (val: T, i: number) => boolean | Promise<boolean>): AsyncIterable<T> {
    let idx = -1;
    for await (const el of source) {
      if (await pred(el, idx += 1)) {
        yield el;
      }
    }
  }

  static async drain<T>(source: AsyncIterable<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const ev of source) {
      items[isIdx(ev) ? ev.idx : items.length] = ev;
    }
    return items;
  }
}