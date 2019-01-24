import * as fs from 'fs';

declare class FsUtilType {
  tmpdir: string;

  mkdirpAsync(rel: string): Promise<void>;
  toURI(path: string): string;
  toNative(path: string): string;
  basename(path: string): string;
  extname(path: string): string;
  dirname(path: string): string;

  resolveNative(base: string, ...rel: string[]): string;
  resolveURI(base: string, ...rel: string[]): string;

  exists(dir: string): Promise<boolean>;
  existsSync(dir: string): boolean;

  readdir(dir: string): Promise<string[]>;
  readdirSync(dir: string): string[];

  readFile(path: string, options: { encoding?: null; flag?: string; } | undefined | null): Promise<Buffer>;
  readFile(path: string, options: { encoding: string; flag?: string; } | string): Promise<Buffer>;
  readFile(path: string, options: { encoding?: string | null; flag?: string; } | string | undefined | null): Promise<Buffer>;
  readFile(path: string): Promise<Buffer>;

  readFileSync(path: string, options: { encoding?: null; flag?: string; } | undefined | null): Buffer;
  readFileSync(path: string, options: { encoding: string; flag?: string; } | string): Buffer;
  readFileSync(path: string, options: { encoding?: string | null; flag?: string; } | string | undefined | null): Buffer;
  readFileSync(path: string): Buffer;

  writeFile(path: string, data: any, options: fs.WriteFileOptions): Promise<void>;
  writeFile(path: string, data: any): Promise<void>;

  writeFileSync(path: string, data: any, options: fs.WriteFileOptions): void;
  writeFileSync(path: string, data: any): void;

  stat(dir: string): Promise<fs.Stats>;
  statSync(dir: string): fs.Stats;

  realpath(dir: string): Promise<string>;
  realpathSync(dir: string): string;

  watch(dir: string, listener?: (event: string, filename: string) => any): fs.FSWatcher;

  watchFile(file: string, options: { persistent?: boolean; interval?: number; } | undefined, listener: (curr: fs.Stats, prev: fs.Stats) => void): void;
  watchFile(file: string, listener: (curr: fs.Stats, prev: fs.Stats) => void): void;

  unwatch(dir: string, poller: (...args: any[]) => any): void;
  unwatchFile(file: string, poller: (...args: any[]) => any): void;

  unlink(file: string): Promise<void>;
  unlinkSync(file: string): void;

  rename(file: string, to: string): Promise<void>;
  renameSync(file: string, to: string): void;

  createReadStream(file: string, options?: string | {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
  }): fs.ReadStream;

  createWriteStream(path: fs.PathLike, options?: string | {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
  }): fs.WriteStream;

  open(path: fs.PathLike, flags: string | number, mode: string | number | undefined | null): Promise<number>;
  open(path: fs.PathLike, flags: string | number): Promise<number>;

  read<TBuffer extends fs.BinaryData>(
    fd: number,
    buffer: TBuffer,
    offset: number,
    length: number,
    position: number | null,
    callback?: (err: NodeJS.ErrnoException, bytesRead: number, buffer: TBuffer) => void,
  ): Promise<{ bytesRead: number, buffer: TBuffer }>;

  mkdtemp(prefix: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null): Promise<string>;
  mkdtemp(prefix: string, options: "buffer" | { encoding: "buffer" }): Promise<Buffer>;
  mkdtemp(prefix: string, options: { encoding?: string | null } | string | undefined | null): Promise<string | Buffer>;
  mkdtemp(prefix: string): Promise<string>;

  mkdtempSync(prefix: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null): string;
  mkdtempSync(prefix: string, options: "buffer" | { encoding: "buffer" }): Buffer;
  mkdtempSync(prefix: string, options: { encoding?: string | null } | string | undefined | null): string | Buffer;
  mkdtempSync(prefix: string): string;
}

export const FsUtil: FsUtilType;