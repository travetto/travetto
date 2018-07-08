import { Stats } from "fs";

export declare class Cache {
  constructor(cwd: string, cacheDir?: string)
  init(): void;
  writeEntry(full: string, contents: string): void;
  readEntry(full: string): string;
  removeEntry(full: string): void;
  hasEntry(full: string): boolean;
  statEntry(full: string): Stats;
  fromEntryName(cached: string): string;
  toEntryName(full: string): string;
  clear(): void;
}

export const AppCache: Cache;