export declare class FsUtil {
  static cwd: string;
  static cacheDir: string;
  static unlinkRecursiveSync(path: string, ignoreErrors?: boolean): void;
  static unlinkRecursive(path: string, ignoreErrors?: boolean): Promise<void>;
  static mkdirp(path: string): Promise<void>;
  static toUnix(base: string): string;
  static toNative(base: string): string;
  static resolveUnix(base: string, ...rest: string[]): string;
  static resolveNative(base: string, ...rest: string[]): string;
  static joinUnix(base: string, ...rest: string[]): string;
  static resolveFrameworkDevFile(pth: string): string;
  static prepareTranspile(fileName: string, contents?: string): string;
  static tempDir(pre: string): void;
  static appRootMatcher(paths: string[]): RegExp;
  static computeModuleFromFile(file: string): string;
}