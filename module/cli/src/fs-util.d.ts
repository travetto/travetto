export declare class FsUtil {
  static cwd: string;
  static toUnix(base: string): string;
  static resolveUnix(base: string, ...rest: string[]): string;
  static joinUnix(base: string, ...rest: string[]): string;
}