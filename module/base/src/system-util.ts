import * as fs from 'fs';
import { Readable, PassThrough } from 'stream';

function find<T>(set: Set<T>, pred: (x: T) => boolean): T | undefined {
  for (const i of set) {
    if (pred(i)) {
      return i;
    }
  }
  return undefined;
}

function toList<T>(items: T | T[] | Set<T> | undefined) {
  if (!items) {
    return [];
  }
  if (Array.isArray(items)) {
    return items;
  }
  if (items instanceof Set) {
    return Array.from(items);
  }
  return [items];
}

export class SystemUtil {

  static async toBuffer(src: NodeJS.ReadableStream | Buffer | string): Promise<Buffer> {
    if (typeof src === 'string') {
      if (src.endsWith('==')) {
        src = Buffer.from(src, 'base64');
      } else {
        src = fs.createReadStream(src);
      }
    }
    if (src instanceof Buffer) {
      return src;
    } else {
      const stream = src as NodeJS.ReadableStream;
      return new Promise<Buffer>((res, rej) => {
        const data: Buffer[] = [];
        stream.on('data', d => data.push(d));
        stream.on('error', rej);
        stream.on('end', (err: any) => {
          err ? rej(err) : res(Buffer.concat(data));
        });
      });
    }
  }

  static toReadable(src: NodeJS.ReadableStream | Buffer | string): NodeJS.ReadableStream {
    if (typeof src === 'string') {
      if (src.endsWith('==')) {
        return this.toReadable(Buffer.from(src, 'base64'));
      } else {
        return fs.createReadStream(src);
      }
    } else if (src instanceof Buffer) {
      const readable = new PassThrough();
      readable.end(src);
      return readable;
    } else {
      return src as Readable;
    }
  }

  static async streamToFile(src: NodeJS.ReadableStream, out: string): Promise<void> {
    const write = fs.createWriteStream(out);
    const finalStream = src.pipe(write);
    await new Promise((res, rej) => {
      finalStream.on('finish', (err) => err ? rej(err) : res());
    });
    return;
  }

  static throttle<T, U, V>(fn: (a: T, b: U) => V, threshold?: number): (a: T, b: U) => V;
  static throttle<T extends Function>(fn: T, threshold = 250) {
    let last = 0;
    let deferTimer: NodeJS.Timer;
    return function (...args: any[]) {
      const now = Date.now();
      if (last && now < last + threshold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.call(null, ...args);
        }, threshold);
      } else {
        last = now;
        fn.call(null, ...args);
      }
    } as any as T;
  }

  static naiveHash(text: string) {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  static computeOrdering<T,
    U extends {
      after?: T | Set<T> | T[];
      before?: T | Set<T> | T[];
      key: T;
    },
    V extends {
      after: Set<T>;
      key: T;
      target: U;
    }
  >(items: U[]) {

    // Turn items into a map by .key value, pointing to a mapping of type V
    const allMap = new Map(items.map(x => [
      x.key, {
        key: x.key,
        target: x,
        after: new Set(toList(x.after))
      }
    ] as [T, V]));

    const all = new Set<V>(allMap.values());

    // Loop through all new items of type V, converting before into after
    for (const item of all) {
      const before = toList(item.target.before);
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
      const next = find(all, x => x.after.size === 0);
      if (!next) {
        throw new Error(`Unsatisfiable dependency: ${Array.from(all).map(x => x.target)}`);
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