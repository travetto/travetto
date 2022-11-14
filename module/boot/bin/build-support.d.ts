export var log: (...args: unknown[]) => void;
export var isFolderStale: (folder: string) => boolean;
export type BuildConfig = {
  outputFolder: string;
  compilerFolder: string;
  watch?: boolean;
};