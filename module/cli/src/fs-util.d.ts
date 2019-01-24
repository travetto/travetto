export declare class FsUtil {
  static cwd: string;
  static cacheDir: string;
  static tempDir(pre: string): void;
  static isDir(rel: string): boolean;
  static remove(rel: string): void;
  static mkdirp(rel: string): void;
  static move(from: string, to: string): void
  static writeFile(rel: string, contents: string): void;
  static readFile(rel: string): string;
  static find(pth: string, test?: (x: string) => boolean, dirs?: boolean): string[];
  static unlinkDirSync(path: string): void;
  static toUnix(base: string): string;
  static toNative(base: string): string;
  static resolveUnix(base: string, ...rest: string[]): string;
  static resolveNative(base: string, ...rest: string[]): string;
  static joinUnix(base: string, ...rest: string[]): string;
}