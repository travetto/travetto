export declare class FsUtil {
  static cwd: string;
  static cacheDir: string;
  static unlinkDirSync(path: string): void;
  static mkdirp(path: string): Promise<void>;
  static toUnix(base: string): string;
  static toNative(base: string): string;
  static resolveUnix(base: string, ...rest: string[]): string;
  static resolveNative(base: string, ...rest: string[]): string;
  static joinUnix(base: string, ...rest: string[]): string;
  static resolveFrameworkFile(pth: string): string;
  static prepareTranspile(fileName: string): string;
}