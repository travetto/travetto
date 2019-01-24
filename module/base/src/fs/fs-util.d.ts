import * as fs from 'fs';

declare class FsUtilType {
  mkdirpAsync(rel: string): Promise<void>;
  toURI(path: string): string;
  toNative(path: string): string;
  resolveNative(base: string, rel: string): string;
  resolveURI(base: string, rel: string): string;

  readdir(dir: string): Promise<string[]>;
  readdirSync(dir: string): string[];

  readFile(dir: string): Promise<Buffer>;
  readFileSync(dir: string): Buffer;

  stat(dir: string): Promise<fs.Stats>;
  statSync(dir: string): fs.Stats;

  realpath(dir: string): Promise<string>;
  realpathSync(dir: string): string;

  watch(dir: string, listener?: (event: string, filename: string) => any): fs.FSWatcher;

  watchFile(file: string, options: { persistent?: boolean; interval?: number; } | undefined, listener: (curr: fs.Stats, prev: fs.Stats) => void): void;
  watchFile(file: string, listener: (curr: fs.Stats, prev: fs.Stats) => void): void;

  unwatch(dir: string, poller: (...args: any[]) => any): void;
  unwatchFile(file: string, poller: (...args: any[]) => any): void;

  createReadStream(file: string, options?: string | {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
  }): fs.ReadStream
}

export const FsUtil: FsUtilType;