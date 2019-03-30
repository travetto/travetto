import * as fs from 'fs';

export interface ScanEntry {
  file: string;
  module: string;
  stats: fs.Stats;
  children?: ScanEntry[];
}

export interface ScanHandler {
  testFile?(relative: string, entry?: ScanEntry): boolean;
  testDir?(relative: string, entry?: ScanEntry): boolean;
}

export interface ReadEntry {
  name: string;
  data: string;
}

export class ScanFs {
  static isDir(x: ScanEntry): boolean;
  static isNotDir(x: ScanEntry): boolean;
  static scanDir(handler: ScanHandler, base: string, entry?: ScanEntry): Promise<ScanEntry[]>;
  static bulkScanDir(handlers: ScanHandler[], base: string): Promise<ScanEntry[]>;
  static scanDirSync(handler: ScanHandler, base: string, entry?: ScanEntry): ScanEntry[];
  static bulkScanDirSync(handlers: ScanHandler[], base: string): ScanEntry[];
  static bulkRequire<T = any>(handlers: ScanHandler[], cwd: string): T[];
  static bulkRead(handlers: ScanHandler[], base: string): Promise<ReadEntry[]>;
  static bulkReadSync(handlers: ScanHandler[], base: string): ReadEntry[];
}