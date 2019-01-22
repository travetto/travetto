import * as fs from 'fs';

declare class FsUtilType {
  mkdirpAsync(rel: string): Promise<void>;
  mkdirAsync(rel: fs.PathLike): Promise<void>;
  readFileAsync(path: fs.PathLike, options?: { encoding?: null; flag?: string; } | string): Promise<Buffer>;
  writeFileAsync(path: fs.PathLike, contents: string | Buffer, options?: fs.WriteFileOptions): Promise<void>;
  statAsync(path: fs.PathLike): Promise<fs.Stats>;
  lstatAsync(path: fs.PathLike): Promise<fs.Stats>;
  existsAsync(path: fs.PathLike): Promise<boolean>;
  unlinkAsync(path: fs.PathLike): Promise<void>;
  renameAsync(from: fs.PathLike, to: fs.PathLike): Promise<void>;

  readlinkAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;
  readlinkAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;
  readlinkAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

  realpathAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;
  realpathAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;
  realpathAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;

  openAsync(path: fs.PathLike, flags: string | number, mode?: string | number | null): Promise<number>;
  writeAsync<TBuffer extends fs.BinaryData>(
    fd: number,
    buffer?: TBuffer,
    offset?: number,
    length?: number,
    position?: number | null,
  ): Promise<{ bytesWritten: number, buffer: TBuffer }>;

  writeAsync(fd: number, string: any, position?: number | null, encoding?: string | null): Promise<{ bytesWritten: number, buffer: string }>;
  readAsync<TBuffer extends fs.BinaryData>(fd: number, buffer: TBuffer, offset: number, length: number, position: number | null): Promise<{ bytesRead: number, buffer: TBuffer }>;
  closeAsync(fd: number): Promise<void>;

  readdirAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string[]>;
  readdirAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer[]>;
  readdirAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string[] | Buffer[]>;

  normalize(path: string): string;
}

export const FsUtil: FsUtilType;