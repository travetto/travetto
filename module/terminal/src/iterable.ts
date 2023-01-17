import timers from 'timers/promises';
import { DelayedConfig, Indexed } from './types';

export type StoppableIterable<T> = { stream: AsyncIterable<T>, stop: () => void };

export type MapFn<T, U> = (val: T, i: number) => U | Promise<U>;

const isIdx = (x: unknown): x is Indexed => (x !== undefined && x !== null) && typeof x === 'object' && 'idx' in x;

export class IterableUtil {

  static DELAY = ({ initialDelay = 0, cycleDelay = 0 }: DelayedConfig = {}) =>
    <T>(x: T, i: number): Promise<T> => timers.setTimeout(i === 0 ? initialDelay : cycleDelay).then(() => x);

  static ORDERED = <T extends Indexed>(): (val: T) => boolean => {
    let last = -1;
    return (v: T): boolean => (last = Math.max(v.idx, last)) === v.idx;
  };

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

  static cycle<T>(items: T[]): StoppableIterable<T> {
    let done = true;
    async function* buildStream(): AsyncIterable<T> {
      let i = -1;
      while (!done) {
        yield items[(i += 1) % items.length];
      }
    }
    return { stream: buildStream(), stop: (): void => { done = false; } };
  }

  static async drain<T>(source: AsyncIterable<T>): Promise<T[]> {
    const items: T[] = [];
    for await (const ev of source) {
      items[isIdx(ev) ? ev.idx : items.length] = ev;
    }
    return items;
  }

  static simpleQueue(): {
    close: () => Promise<void>;
    add: <T>(item: () => Promise<T>) => Promise<T>;
    running: Promise<void>;
  } {
    let done = false;
    let fire: () => void;
    let next = new Promise<void>(r => fire = r);

    const queue: Function[] = [];
    async function run(): Promise<void> {
      while (!done) {
        if (!queue.length) {
          await next;
          next = new Promise(r => fire = r);
        }
        await queue.shift()?.();
      }
    }
    const running = run();
    return {
      running,
      close: (): Promise<void> => {
        done = true;
        fire();
        return running;
      },
      add: <T>(fn: () => Promise<T>): Promise<T> => {
        const prom = new Promise<T>(r => queue.push(() => fn().then(r)));
        fire();
        return prom;
      }
    };
  }
}