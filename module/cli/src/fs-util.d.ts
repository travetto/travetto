declare class FsUtilType {
  reorient(file: string): string;
  deorient(file: string): string;
  tempDir(pre: string): void;
  isDir(rel: string): boolean;
  remove(rel: string): void;
  mkdirp(rel: string): void;
  mkdirpAsync(rel: string): Promise<void>;
  move(from: string, to: string): void
  writeFile(rel: string, contents: string): void;
  readFile(rel: string): string;
  find(pth: string, test?: (x: string) => boolean, dirs?: boolean): string[];
}

export const FsUtil: FsUtilType;